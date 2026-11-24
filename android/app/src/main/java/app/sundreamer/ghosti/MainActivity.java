package app.sundreamer.ghosti;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.IntentSender;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    public interface IntentSenderResultCallback {
        void onResult(int resultCode, Intent data);
    }

    private static final int REQ_MEDIASTORE_TRASH = 51991;
    private static volatile long lastRendererRecoveryAtMs = 0L;
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
            boolean isMainThread = (thread == Looper.getMainLooper().getThread());
            if (!isMainThread
                && throwable instanceof IllegalStateException
                && (msg.contains("FirebaseApp") || msg.contains("FirebaseInitProvider"))) {
                Log.w("GhostiMainActivity", "Suppressed background uninitialized FirebaseApp exception on thread " + thread.getName() + ": " + msg);
                return;
            }
            if (prevHandler != null) {
                prevHandler.uncaughtException(thread, throwable);
            }
        });
        registerPlugin(GhostiMobileCarePlugin.class);
        super.onCreate(savedInstanceState);
        captureIncomingDeepLinkIntent(getIntent());

        // [2귀신] 안드로이드 하드웨어/제스처 뒤로가기 시 앱 즉시 종료 방지:
        // 열려 있는 사진 상세/OCR/공유 모달이 있으면 모달만 닫고, 하위 탭이면 홈으로 복귀하며, 루트 홈일 때만 백그라운드로 이동합니다.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = (bridge != null) ? bridge.getWebView() : null;
                if (wv == null) {
                    moveTaskToBack(true);
                    return;
                }
                wv.evaluateJavascript(
                    "(function(){ try { return typeof window.__ghostiHandleNativeBack === 'function' ? !!window.__ghostiHandleNativeBack() : false; } catch(e) { return false; } })()",
                    value -> {
                        if ("true".equals(value)) {
                            return;
                        }
                        if (wv.canGoBack()) {
                            wv.goBack();
                        } else {
                            moveTaskToBack(true);
                        }
                    }
                );
            }
        });

        // [스마트폰 카메라/갤러리 동영상 무복사 64-bit HTTP 206 Range 스트리밍 브릿지 & WebView 렌더러 강제종료 방어]:
        // 1) Capacitor 기본 WebViewLocalServer는 content:// 요청 시 FileChannel.position(seek)을 누락하므로 64-bit Range 206 송출.
        // 2) BridgeWebViewClient.onRenderProcessGone 기본값(false)은 저사양 기기 WASM/미디어 메모리 회수 시 OS 전체 앱을 강제종료시키므로,
        //    true를 반환해 프로세스 크래시를 원천 차단하고 15초 쿨다운 가드 하에 즉시 안전 복구(recreate)합니다.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            try {
                // 안드로이드 OS 시스템 글꼴 크기 확대(115~140%)로 인해 좁은 모바일 입력창 안내문구·버튼이 깨지는 현상 차단
                this.bridge.getWebView().getSettings().setTextZoom(100);
            } catch (Throwable ignored) {
            }
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

                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    boolean crashed = detail != null && detail.didCrash();
                    Log.w("GhostiMainActivity", "WebView renderer gone (didCrash=" + crashed + ") — recovering without host force-close.");
                    long now = SystemClock.elapsedRealtime();
                    if (now - lastRendererRecoveryAtMs > 15000L) {
                        lastRendererRecoveryAtMs = now;
                        runOnUiThread(() -> {
                            try {
                                if (!isFinishing() && !isDestroyed()) {
                                    recreate();
                                }
                            } catch (Throwable ignored) {
                            }
                        });
                    }
                    return true;
                }
            });
        }

        // [Android 15/16 Edge-to-Edge & 소프트 키보드(IME) 빈 여백 0px 단일 제어]:
        // Capacitor 내장 SystemBars 이중 패딩을 비활성화하고(insetsHandling='disable'),
        // 본 단일 리스너에서만 상태바·컷아웃·키보드(IME) 높이를 정확히 1회 반영한 뒤 하위 WebView에는 Insets.NONE을 전달하여
        // 삼성 키보드 위 하얀 빈칸(이중 차감) 및 adjustPan 상단 대화 밀림 현상을 원천 차단합니다.
        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.WHITE);
            window.setNavigationBarColor(Color.parseColor("#F8F7F4"));
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(true);
                controller.setAppearanceLightNavigationBars(true);
            }
        }
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.WHITE);
            final boolean[] lastImeOpen = new boolean[] { false };
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets sysInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                boolean imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime()) && imeInsets.bottom > sysInsets.bottom;
                int bottomPad = imeVisible ? imeInsets.bottom : sysInsets.bottom;
                v.setPadding(sysInsets.left, sysInsets.top, sysInsets.right, bottomPad);

                if (lastImeOpen[0] != imeVisible && this.bridge != null && this.bridge.getWebView() != null) {
                    lastImeOpen[0] = imeVisible;
                    final boolean openNow = imeVisible;
                    this.bridge.getWebView().post(() -> {
                        try {
                            this.bridge.getWebView().evaluateJavascript(
                                "window.dispatchEvent(new CustomEvent('ghostiKeyboardState', { detail: { open: " + openNow + ", height: 0, platform: 'android' } }));",
                                null
                            );
                        } catch (Throwable ignored) {
                        }
                    });
                }

                return new WindowInsetsCompat.Builder(windowInsets)
                    .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                    .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                    .build();
            });
            ViewCompat.requestApplyInsets(contentView);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureIncomingDeepLinkIntent(intent);
    }

    private void captureIncomingDeepLinkIntent(Intent intent) {
        if (intent == null) return;
        // 최근 앱 목록(Recents)에서 앱을 다시 열 때 Android가 과거 초대 링크 Intent를 재전달하는 현상 원천 차단
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
            return;
        }
        Uri data = intent.getData();
        if (data == null) return;
        String urlStr = data.toString();
        if (urlStr == null || urlStr.trim().isEmpty()) return;
        String lower = urlStr.toLowerCase();
        if (!lower.startsWith("ghosti://") && !lower.contains("invite=")) {
            return;
        }
        // 동일 Intent가 onCreate/recreate 시 재소비되지 않도록 즉시 소비 처리
        try {
            intent.setData(null);
        } catch (Throwable ignored) {
        }
        try {
            getSharedPreferences("ghosti_deep_links", MODE_PRIVATE)
                .edit()
                .putString("pending_deep_link_url", urlStr)
                .apply();
        } catch (Throwable ignored) {
        }
        if (this.bridge != null && this.bridge.getWebView() != null) {
            final String escaped = org.json.JSONObject.quote(urlStr);
            this.bridge.getWebView().post(() -> {
                try {
                    this.bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('ghostiNativeDeepLink', { detail: { url: " + escaped + " } }));",
                        null
                    );
                } catch (Throwable ignored) {
                }
            });
        }
    }

    private File materializeSeekableVideoCache(ContentResolver resolver, Uri videoUri, long mediaId) {
        try {
            File cacheRoot = new File(getCacheDir(), "ghosti_vid_stream");
            if (!cacheRoot.exists()) {
                cacheRoot.mkdirs();
            }
            File target = new File(cacheRoot, "vid_" + mediaId + ".mp4");
            if (target.exists() && target.length() > 4096L) {
                target.setLastModified(System.currentTimeMillis());
                return target;
            }
            File[] existing = cacheRoot.listFiles();
            if (existing != null && existing.length >= 6) {
                Arrays.sort(existing, Comparator.comparingLong(File::lastModified));
                for (int i = 0; i <= existing.length - 6; i++) {
                    try {
                        existing[i].delete();
                    } catch (Throwable ignored) {
                    }
                }
            }
            File tmp = new File(cacheRoot, "vid_" + mediaId + "_" + System.nanoTime() + ".tmp");
            try (InputStream in = resolver.openInputStream(videoUri);
                 FileOutputStream out = new FileOutputStream(tmp)) {
                if (in == null) {
                    return null;
                }
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                }
                out.flush();
            }
            if (tmp.exists() && tmp.length() > 1024L) {
                if (target.exists()) {
                    target.delete();
                }
                if (tmp.renameTo(target)) {
                    return target;
                }
                return tmp;
            } else if (tmp.exists()) {
                tmp.delete();
            }
        } catch (Throwable t) {
            Log.w("GhostiMainActivity", "materializeSeekableVideoCache failed: " + t.getMessage());
        }
        return null;
    }

    private WebResourceResponse serveMediaStoreVideoRange(WebResourceRequest request, String path) {
        try {
            if (request != null && "OPTIONS".equalsIgnoreCase(request.getMethod())) {
                Map<String, String> corsHeaders = new HashMap<>();
                corsHeaders.put("Access-Control-Allow-Origin", "*");
                corsHeaders.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                corsHeaders.put("Access-Control-Allow-Headers", "Range, Content-Type");
                return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", corsHeaders, new java.io.ByteArrayInputStream(new byte[0]));
            }
            String tail = path.substring("/__ghosti_media_video/".length());
            boolean preferH264 = tail.startsWith("h264_");
            String digits = tail.replaceAll("[^0-9]", "");
            if (digits.isEmpty()) {
                return null;
            }
            long mediaId = Long.parseLong(digits);
            Uri videoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, mediaId);
            ContentResolver resolver = getContentResolver();
            String rawMime = resolver.getType(videoUri);
            String mimeType = (rawMime != null && rawMime.toLowerCase().contains("webm"))
                ? "video/webm"
                : "video/mp4";

            File cacheRoot = new File(getCacheDir(), "ghosti_vid_stream");
            File h264Cached = new File(cacheRoot, "vid_h264_v3_" + mediaId + ".mp4");

            FileInputStream fis = null;
            long totalSize = -1L;

            if (h264Cached.exists() && h264Cached.length() > 4096L) {
                h264Cached.setLastModified(System.currentTimeMillis());
                fis = new FileInputStream(h264Cached);
                totalSize = h264Cached.length();
                mimeType = "video/mp4";
            } else if (!preferH264) {
                ParcelFileDescriptor pfd = null;
                try {
                    pfd = resolver.openFileDescriptor(videoUri, "r");
                    if (pfd != null) {
                        long statSz = pfd.getStatSize();
                        // 180MB 이하 일반 촬영 영상은 Scoped Storage GPS Redaction 파이프(position(0)만 통과 후 후미 moov 탐색 시 ESPIPE 실패)를
                        // 원천 우회하기 위해 항상 로컬 파일 캐시(ghosti_vid_stream)로 실체화하여 100% 무결한 임의 탐색을 보장합니다.
                        if (statSz > 188743680L) {
                            ParcelFileDescriptor.AutoCloseInputStream directIn = new ParcelFileDescriptor.AutoCloseInputStream(pfd);
                            pfd = null;
                            directIn.getChannel().position(statSz - 64L);
                            int probeByte = directIn.read();
                            if (probeByte >= 0) {
                                directIn.getChannel().position(0L);
                                fis = directIn;
                                totalSize = statSz;
                            } else {
                                directIn.close();
                            }
                        }
                    }
                } catch (Throwable seekErr) {
                    if (fis != null) {
                        try {
                            fis.close();
                        } catch (Throwable ignored) {
                        }
                        fis = null;
                    }
                } finally {
                    if (pfd != null) {
                        try {
                            pfd.close();
                        } catch (Throwable ignored) {
                        }
                    }
                }
            }

            if (fis == null || totalSize <= 0L) {
                File cached = materializeSeekableVideoCache(resolver, videoUri, mediaId);
                if (cached == null || !cached.exists() || cached.length() <= 0L) {
                    return null;
                }
                fis = new FileInputStream(cached);
                totalSize = cached.length();
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
