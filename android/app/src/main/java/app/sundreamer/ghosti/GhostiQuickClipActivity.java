package app.sundreamer.ghosti;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * [Ghosti 3귀신] Android 무화면 OS 직송 액티비티 (앱 화면 오픈 0%)
 * 1) 글자 드래그 ➔ [PC로 보내기] (ACTION_PROCESS_TEXT) 1탭 ➔ 0.3초 만에 PC Ctrl+V 직송
 * 2) 사진·스크린샷·링크 [공유] ➔ [귀신같이] (ACTION_SEND / ACTION_SEND_MULTIPLE) 2탭 ➔ PC Ctrl+V 즉시 도착
 */
public class GhostiQuickClipActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        overridePendingTransition(0, 0);
        super.onCreate(savedInstanceState);
        GhostiNativeClipboardSync.startPhonePushInboxWatcher(getApplicationContext());
        handleQuickShareIntent(getIntent());
    }

    private void finishSilently() {
        finish();
        overridePendingTransition(0, 0);
    }

    private void handleQuickShareIntent(Intent intent) {
        if (intent == null) {
            finishSilently();
            return;
        }
        String action = intent.getAction();
        String mime = intent.getType() != null ? intent.getType().toLowerCase() : "";

        // 1) 사진·스크린샷 공유 직송 (ACTION_SEND / ACTION_SEND_MULTIPLE image/*)
        if ((Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action))
            && mime.startsWith("image/")) {
            List<Uri> imageUris = new ArrayList<>();
            if (Intent.ACTION_SEND.equals(action)) {
                Uri single = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (single != null) imageUris.add(single);
            } else {
                ArrayList<Uri> multi = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (multi != null) {
                    for (Uri u : multi) {
                        if (u != null && imageUris.size() < 5) imageUris.add(u);
                    }
                }
            }
            if (imageUris.isEmpty()) {
                Toast.makeText(getApplicationContext(), "전송할 사진을 읽지 못했습니다.", Toast.LENGTH_SHORT).show();
                finishSilently();
                return;
            }
            // Scoped Storage URI 임시 읽기 권한은 finish() 직후 회수되므로 먼저 메모리로 바이트를 읽어둔 뒤 즉시 투명 종료!
            final List<RawSharedImage> capturedImages = new ArrayList<>();
            ContentResolver resolver = getContentResolver();
            for (Uri uri : imageUris) {
                byte[] rawBytes = readUriBytesFast(resolver, uri, 22 * 1024 * 1024);
                if (rawBytes != null && rawBytes.length > 0) {
                    String fn = resolveDisplayName(resolver, uri);
                    String resolvedMime = resolver.getType(uri);
                    capturedImages.add(new RawSharedImage(rawBytes, fn, resolvedMime != null ? resolvedMime : mime));
                }
            }
            if (capturedImages.isEmpty()) {
                Toast.makeText(getApplicationContext(), "사진 데이터를 읽지 못했습니다.", Toast.LENGTH_SHORT).show();
                finishSilently();
                return;
            }
            Toast.makeText(getApplicationContext(), "💻 사진을 PC(Ctrl+V)로 바로 보냈습니다!", Toast.LENGTH_SHORT).show();
            final android.content.Context appCtx = getApplicationContext();
            new Thread(() -> {
                for (RawSharedImage raw : capturedImages) {
                    encodeAndDispatchPhoto(appCtx, raw);
                }
            }, "ghosti-quick-photo-send").start();
            finishSilently();
            return;
        }

        // 2) 텍스트·링크 무화면 직송 (ACTION_PROCESS_TEXT / ACTION_SEND text/plain)
        CharSequence captured = null;
        if (Intent.ACTION_PROCESS_TEXT.equals(action)) {
            captured = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
        } else if (Intent.ACTION_SEND.equals(action)) {
            captured = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if ((captured == null || captured.length() == 0) && intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT) != null) {
                captured = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
            }
        }
        String text = sanitizeSharedWebSelectionText(captured != null ? captured.toString() : "", action);
        if (text.isEmpty()) {
            Toast.makeText(getApplicationContext(), "전송할 글자가 비어 있습니다.", Toast.LENGTH_SHORT).show();
            finishSilently();
            return;
        }
        GhostiSharedClipboardStore.pushLocalCapturedClip(
            getApplicationContext(),
            text,
            GhostiSharedClipboardStore.defaultDeviceLabel() + " (PC로 보내기)"
        );
        Toast.makeText(getApplicationContext(), "💻 PC 클립보드(Ctrl+V)로 바로 보냈습니다!", Toast.LENGTH_SHORT).show();
        finishSilently();
    }

    /**
     * 안드로이드 크롬·삼성 브라우저에서 웹 본문을 드래그한 뒤 [공유 ➔ 귀신같이]를 눌렀을 때
     * 브라우저가 자동으로 덧붙이는 하단 페이지 링크(https://...#:~:text=...) 및 감싸는 따옴표("...")를 제거해
     * 드래그한 순수 글자만 깔끔하게 전송합니다. (순수 URL 단독 공유 시에는 URL 그대로 보존)
     */
    private static String sanitizeSharedWebSelectionText(String raw, String action) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return "";
        if (!Intent.ACTION_SEND.equals(action)) {
            return trimmed;
        }
        // 순수 단일 URL 공유(주소창 공유 등)는 그대로 보존
        if (trimmed.matches("^https?://\\S+$")) {
            return trimmed;
        }
        // 1순위: Chrome Highlight Share ("드래그한 문장"\n https://...#:~:text=...) 또는 본문 뒤 줄바꿈 URL 제거
        java.util.regex.Matcher m = java.util.regex.Pattern
            .compile("(?s)^(.+?)(?:\\r?\\n\\s*|\\s+)(https?://\\S+)\\s*$")
            .matcher(trimmed);
        if (m.matches()) {
            String bodyPart = m.group(1) != null ? m.group(1).trim() : "";
            String trailingUrl = m.group(2) != null ? m.group(2).trim() : "";
            boolean isHighlightFragment = trailingUrl.contains("#:~:text=");
            boolean wasNewlineSeparated = trimmed.substring(m.end(1), m.start(2)).contains("\n");
            if (!bodyPart.isEmpty() && !bodyPart.matches("^https?://\\S+$") && (isHighlightFragment || wasNewlineSeparated)) {
                if ((bodyPart.startsWith("\"") && bodyPart.endsWith("\"") && bodyPart.length() >= 2)
                    || (bodyPart.startsWith("“") && bodyPart.endsWith("”") && bodyPart.length() >= 2)) {
                    bodyPart = bodyPart.substring(1, bodyPart.length() - 1).trim();
                }
                if (!bodyPart.isEmpty()) {
                    return bodyPart;
                }
            }
        }
        return trimmed;
    }

    private static final class RawSharedImage {
        final byte[] bytes;
        final String fileName;
        final String mimeType;

        RawSharedImage(byte[] bytes, String fileName, String mimeType) {
            this.bytes = bytes;
            this.fileName = fileName;
            this.mimeType = mimeType;
        }
    }

    private static byte[] readUriBytesFast(ContentResolver resolver, Uri uri, int maxBytes) {
        try (InputStream is = resolver.openInputStream(uri);
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            if (is == null) return null;
            byte[] buf = new byte[65536];
            int total = 0;
            int n;
            while ((n = is.read(buf)) > 0) {
                total += n;
                if (total > maxBytes) return null;
                bos.write(buf, 0, n);
            }
            return bos.toByteArray();
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static String resolveDisplayName(ContentResolver resolver, Uri uri) {
        try (Cursor c = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String name = c.getString(0);
                if (name != null && !name.trim().isEmpty()) {
                    return name.trim();
                }
            }
        } catch (Throwable ignored) {
        }
        return "phone_share_" + System.currentTimeMillis() + ".jpg";
    }

    private static void encodeAndDispatchPhoto(android.content.Context appCtx, RawSharedImage raw) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw.bytes, 0, raw.bytes.length, bounds);
            int origW = bounds.outWidth;
            int origH = bounds.outHeight;
            if (origW <= 0 || origH <= 0) return;

            int rotationDeg = 0;
            try {
                ExifInterface exif = new ExifInterface(new ByteArrayInputStream(raw.bytes));
                int ori = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                if (ori == ExifInterface.ORIENTATION_ROTATE_90) rotationDeg = 90;
                else if (ori == ExifInterface.ORIENTATION_ROTATE_180) rotationDeg = 180;
                else if (ori == ExifInterface.ORIENTATION_ROTATE_270) rotationDeg = 270;
            } catch (Throwable ignored) {
            }

            // 스크린샷·표 글자 선명도를 완벽 유지하면서 0.2초 전송이 가능한 최대 2560px 고선명 인코딩
            int maxDim = Math.max(origW, origH);
            int sample = 1;
            while ((maxDim / sample) > 3600) {
                sample *= 2;
            }
            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
            decodeOpts.inSampleSize = sample;
            Bitmap bmp = BitmapFactory.decodeByteArray(raw.bytes, 0, raw.bytes.length, decodeOpts);
            if (bmp == null) return;

            int curMax = Math.max(bmp.getWidth(), bmp.getHeight());
            float scale = curMax > 2560 ? (2560f / (float) curMax) : 1.0f;
            if (rotationDeg != 0 || scale < 0.999f) {
                Matrix m = new Matrix();
                if (scale < 0.999f) m.postScale(scale, scale);
                if (rotationDeg != 0) m.postRotate(rotationDeg);
                Bitmap transformed = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
                if (transformed != bmp) {
                    bmp.recycle();
                    bmp = transformed;
                }
            }

            int outW = bmp.getWidth();
            int outH = bmp.getHeight();
            boolean preferPng = raw.mimeType != null && raw.mimeType.contains("png") && raw.bytes.length <= (2200 * 1024) && rotationDeg == 0 && scale >= 0.999f;
            byte[] sendBytes;
            String sendMime;
            String sendName = raw.fileName;
            if (preferPng) {
                sendBytes = raw.bytes;
                sendMime = "image/png";
                if (!sendName.toLowerCase().endsWith(".png")) sendName = sendName + ".png";
            } else {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, 90, out);
                sendBytes = out.toByteArray();
                sendMime = "image/jpeg";
                if (!sendName.toLowerCase().endsWith(".jpg") && !sendName.toLowerCase().endsWith(".jpeg")) {
                    int dot = sendName.lastIndexOf('.');
                    sendName = (dot > 0 ? sendName.substring(0, dot) : sendName) + ".jpg";
                }
            }
            bmp.recycle();

            GhostiNativeClipboardSync.pushPhotoToPcSync(appCtx, sendBytes, sendName, sendMime, outW, outH);
        } catch (Throwable ignored) {
        }
    }
}
