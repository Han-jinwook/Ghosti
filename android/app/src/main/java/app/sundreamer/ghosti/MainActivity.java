package app.sundreamer.ghosti;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.IntentSender;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    public interface IntentSenderResultCallback {
        void onResult(int resultCode, Intent data);
    }

    private static final int REQ_MEDIASTORE_TRASH = 51991;
    private IntentSenderResultCallback pendingTrashCallback = null;

    public void launchMediaStoreIntentSender(IntentSender sender, IntentSenderResultCallback callback) throws IntentSender.SendIntentException {
        this.pendingTrashCallback = callback;
        startIntentSenderForResult(sender, REQ_MEDIASTORE_TRASH, null, 0, 0, 0);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_MEDIASTORE_TRASH) {
            IntentSenderResultCallback cb = this.pendingTrashCallback;
            this.pendingTrashCallback = null;
            if (cb != null) {
                cb.onResult(resultCode, data);
                return;
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        final Thread.UncaughtExceptionHandler prevHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            String msg = throwable != null && throwable.getMessage() != null ? throwable.getMessage() : "";
            if (throwable instanceof IllegalStateException
                && (msg.contains("FirebaseApp") || msg.contains("FirebaseInitProvider"))) {
                Log.w("GhostiMainActivity", "Suppressed uninitialized FirebaseApp exception on thread " + thread.getName() + ": " + msg);
                return;
            }
            if (prevHandler != null) {
                prevHandler.uncaughtException(thread, throwable);
            }
        });
        registerPlugin(GhostiMobileCarePlugin.class);
        super.onCreate(savedInstanceState);

        // [스마트폰 카메라/갤러리 동영상 무복사 64-bit HTTP 206 Range 스트리밍 브릿지]:
        // Capacitor 기본 WebViewLocalServer는 content:// 요청 시 FileChannel.position(seek)을 누락하여
        // 파일 끝에 moov 인덱스가 있는 스마트폰 촬영 영상 재생이 실패하므로, /__ghosti_media_video/{id}.mp4 경로를
        // ParcelFileDescriptor 직접 탐색(64-bit Range 206)으로 즉시 송출합니다.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.setWebViewClient(new BridgeWebViewClient(this.bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (request != null && request.getUrl() != null) {
                        String path = request.getUrl().getPath();
                        if (path != null && path.startsWith("/__ghosti_media_video/")) {
                            WebResourceResponse vidResp = serveMediaStoreVideoRange(request, path);
                            if (vidResp != null) {
                                return vidResp;
                            }
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }
            });
        }

        // [Android 15/16 Edge-to-Edge Safe Area & 상태바 시계/배터리 가시성 보장]:
        // 기본 웜 라이트 배경(#F8F7F4)과 어두운 상태바 아이콘(LightStatusBars=true)을 일치시켜 검정 배경에 시계·배터리가 묻히지 않게 보장
        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.parseColor("#F8F7F4"));
            window.setNavigationBarColor(Color.parseColor("#F8F7F4"));
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(true);
                controller.setAppearanceLightNavigationBars(true);
            }
        }
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#F8F7F4"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentView);
        }
    }

    private WebResourceResponse serveMediaStoreVideoRange(WebResourceRequest request, String path) {
        try {
            String tail = path.substring("/__ghosti_media_video/".length());
            String digits = tail.replaceAll("[^0-9]", "");
            if (digits.isEmpty()) {
                return null;
            }
            long mediaId = Long.parseLong(digits);
            Uri videoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, mediaId);
            ContentResolver resolver = getContentResolver();
            String mimeType = resolver.getType(videoUri);
            if (mimeType == null || mimeType.trim().isEmpty()) {
                mimeType = "video/mp4";
            }

            ParcelFileDescriptor pfd = resolver.openFileDescriptor(videoUri, "r");
            if (pfd == null) {
                return null;
            }
            long totalSize = pfd.getStatSize();
            if (totalSize <= 0) {
                ParcelFileDescriptor.AutoCloseInputStream rawIn = new ParcelFileDescriptor.AutoCloseInputStream(pfd);
                Map<String, String> basicHeaders = new HashMap<>();
                basicHeaders.put("Access-Control-Allow-Origin", "*");
                return new WebResourceResponse(mimeType, null, 200, "OK", basicHeaders, rawIn);
            }

            Map<String, String> reqHeaders = request.getRequestHeaders();
            String rangeHeader = null;
            if (reqHeaders != null) {
                for (Map.Entry<String, String> entry : reqHeaders.entrySet()) {
                    if (entry.getKey() != null && "range".equalsIgnoreCase(entry.getKey())) {
                        rangeHeader = entry.getValue();
                        break;
                    }
                }
            }

            ParcelFileDescriptor.AutoCloseInputStream fis = new ParcelFileDescriptor.AutoCloseInputStream(pfd);
            Map<String, String> respHeaders = new HashMap<>();
            respHeaders.put("Accept-Ranges", "bytes");
            respHeaders.put("Access-Control-Allow-Origin", "*");

            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                String spec = rangeHeader.substring("bytes=".length()).trim();
                int commaIdx = spec.indexOf(',');
                if (commaIdx >= 0) {
                    spec = spec.substring(0, commaIdx).trim();
                }
                int dashIdx = spec.indexOf('-');
                long start = 0;
                long end = totalSize - 1;
                if (dashIdx >= 0) {
                    String left = spec.substring(0, dashIdx).trim();
                    String right = spec.substring(dashIdx + 1).trim();
                    if (!left.isEmpty()) {
                        start = Long.parseLong(left);
                    }
                    if (!right.isEmpty()) {
                        end = Math.min(totalSize - 1, Long.parseLong(right));
                    } else if (left.isEmpty() && !right.isEmpty()) {
                        long suffixLen = Long.parseLong(right);
                        start = Math.max(0, totalSize - suffixLen);
                    }
                }
                if (start < 0 || start >= totalSize || end < start) {
                    fis.close();
                    respHeaders.put("Content-Range", "bytes */" + totalSize);
                    return new WebResourceResponse(mimeType, null, 416, "Requested Range Not Satisfiable", respHeaders, null);
                }
                fis.getChannel().position(start);
                long chunkLen = end - start + 1;
                respHeaders.put("Content-Range", "bytes " + start + "-" + end + "/" + totalSize);
                respHeaders.put("Content-Length", String.valueOf(chunkLen));
                return new WebResourceResponse(mimeType, null, 206, "Partial Content", respHeaders, new BoundedInputStream(fis, chunkLen));
            }

            respHeaders.put("Content-Length", String.valueOf(totalSize));
            return new WebResourceResponse(mimeType, null, 200, "OK", respHeaders, fis);
        } catch (Throwable t) {
            Log.w("GhostiMainActivity", "serveMediaStoreVideoRange failed: " + t.getMessage());
            return null;
        }
    }

    private static final class BoundedInputStream extends FilterInputStream {
        private long remaining;

        BoundedInputStream(InputStream in, long maxBytes) {
            super(in);
            this.remaining = Math.max(0, maxBytes);
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int b = super.read();
            if (b >= 0) {
                remaining--;
            }
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int toRead = (int) Math.min(len, remaining);
            int n = super.read(b, off, toRead);
            if (n > 0) {
                remaining -= n;
            }
            return n;
        }

        @Override
        public int available() throws IOException {
            int sup = super.available();
            return (int) Math.min(sup, Math.min(Integer.MAX_VALUE, remaining));
        }
    }
}
