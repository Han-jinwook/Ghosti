package app.sundreamer.ghosti;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * [Ghosti 3귀신] Android 앱 미진입 직결 E2EE 클립보드 동기화 엔진
 * - 본체 앱(WebView)을 열지 않은 상태에서 [귀신 7일 클립보드] 키보드(IME) 또는
 *   텍스트 선택/공유([귀신 클립보드 저장])로 복사한 내용을 Java 백그라운드 스레드에서
 *   즉시 AES-256-GCM 암호화(JS와 100% 동일 PBKDF2 키 파생)하여 PC로 직통 전송합니다.
 * - 반대로 [귀신 7일 클립보드] 키보드가 열릴 때 PC의 최신 복사본을 직접 수신·복호화해
 *   앱 전환이나 새로고침 없이 카톡·크롬·메모장 입력창에서 바로 커서에 꽂습니다.
 */
public final class GhostiNativeClipboardSync {
    private static final String AUTH_PREFS = "ghosti_native_clip_auth_v1";
    private static final String DEFAULT_BRIDGE_URL =
        "https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge";

    private static final ExecutorService IO_EXECUTOR = Executors.newSingleThreadExecutor();
    private static final ConcurrentHashMap<String, SecretKey> KEY_CACHE = new ConcurrentHashMap<>();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static volatile long sLastPullAtMs = 0L;

    private GhostiNativeClipboardSync() {}

    public static void saveAuthContext(
        Context ctx,
        String email,
        String canonicalUserId,
        String hubToken,
        String deviceId,
        String deviceName,
        String bridgeUrl
    ) {
        if (ctx == null) return;
        String normEmail = email != null ? email.trim().toLowerCase() : "";
        String normUid = canonicalUserId != null ? canonicalUserId.trim() : "";
        String normToken = hubToken != null ? hubToken.trim() : "";
        String normDevId = deviceId != null ? deviceId.trim() : "";
        String normDevName = deviceName != null ? deviceName.trim() : GhostiSharedClipboardStore.defaultDeviceLabel();
        String normUrl = (bridgeUrl != null && bridgeUrl.trim().startsWith("https://"))
            ? bridgeUrl.trim()
            : DEFAULT_BRIDGE_URL;

        SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
        if (normEmail.isEmpty() || normToken.isEmpty()) {
            prefs.edit().clear().apply();
            return;
        }
        prefs.edit()
            .putString("email", normEmail)
            .putString("canonicalUserId", normUid)
            .putString("hubToken", normToken)
            .putString("deviceId", normDevId)
            .putString("deviceName", normDevName)
            .putString("bridgeUrl", normUrl)
            .apply();

        // 키보드/선택 툴바 호출 시 0.01초 즉시 암호화되도록 백그라운드에서 PBKDF2 키 선행 예열
        if (!normUid.isEmpty()) {
            IO_EXECUTOR.execute(() -> {
                try {
                    deriveAesKey(normEmail, normUid);
                } catch (Throwable ignored) {
                }
            });
        }
    }

    private static SecretKey deriveAesKey(String normEmail, String normUid) throws Exception {
        String tag = normEmail + "::" + normUid;
        SecretKey cached = KEY_CACHE.get(tag);
        if (cached != null) return cached;

        String password = "ghosti-e2ee-clip-v1::" + normEmail + "::" + normUid;
        byte[] salt = ("ghosti-salt-v1::" + normEmail).getBytes(StandardCharsets.UTF_8);
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 60000, 256);
        SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        byte[] keyBytes = skf.generateSecret(spec).getEncoded();
        SecretKey key = new SecretKeySpec(keyBytes, "AES");
        if (KEY_CACHE.size() > 8) KEY_CACHE.clear();
        KEY_CACHE.put(tag, key);
        return key;
    }

    private static JSONObject postBridgeJson(String endpoint, String hubToken, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Authorization", "Bearer " + hubToken);
            byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }
            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            if (is == null) return null;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line);
                }
            }
            if (code >= 200 && code < 300) {
                return new JSONObject(sb.toString());
            }
        } catch (Throwable ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    /**
     * 외부 앱(키보드 IME·텍스트 선택·공유 시트)에서 캡처한 텍스트를 본체 앱 실행 없이 PC로 직통 E2EE 전송합니다.
     */
    public static void pushEntryAsync(Context ctx, GhostiSharedClipboardStore.ClipEntry entry) {
        if (ctx == null || entry == null || entry.text == null || entry.text.trim().isEmpty()) return;
        final Context appCtx = ctx.getApplicationContext();
        IO_EXECUTOR.execute(() -> {
            try {
                SharedPreferences prefs = appCtx.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
                String email = prefs.getString("email", "");
                String uid = prefs.getString("canonicalUserId", "");
                String hubToken = prefs.getString("hubToken", "");
                String devId = prefs.getString("deviceId", "");
                String devName = prefs.getString("deviceName", GhostiSharedClipboardStore.defaultDeviceLabel());
                String endpoint = prefs.getString("bridgeUrl", DEFAULT_BRIDGE_URL);
                if (email.isEmpty() || uid.isEmpty() || hubToken.isEmpty()) return;

                SecretKey key = deriveAesKey(email, uid);
                byte[] iv = new byte[12];
                SECURE_RANDOM.nextBytes(iv);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
                byte[] cipherBytes = cipher.doFinal(entry.text.getBytes(StandardCharsets.UTF_8));

                JSONObject req = new JSONObject();
                req.put("action", "device_push_e2ee_clip");
                req.put("clipHash", entry.clipHash);
                req.put("cipherB64", Base64.encodeToString(cipherBytes, Base64.NO_WRAP));
                req.put("ivB64", Base64.encodeToString(iv, Base64.NO_WRAP));
                req.put("senderDeviceId", devId.isEmpty() ? "android-native-direct" : devId);
                req.put("senderName", entry.senderName != null && !entry.senderName.isEmpty() ? entry.senderName : devName);
                req.put("createdAt", entry.createdAt);

                JSONObject resp = postBridgeJson(endpoint, hubToken, req);
                if (resp != null && resp.optBoolean("ok", false)) {
                    String serverUid = resp.optString("canonicalUserId", "").trim();
                    if (!serverUid.isEmpty() && !serverUid.equals(uid)) {
                        prefs.edit().putString("canonicalUserId", serverUid).apply();
                    }
                    GhostiSharedClipboardStore.removePendingOutboundByHash(appCtx, entry.clipHash);
                }
            } catch (Throwable ignored) {
            }
        });
    }

    /**
     * [귀신 7일 클립보드] 키보드 오픈 시 본체 앱을 열지 않고도 PC에서 복사한 최신 E2EE 클립보드를 직통 수신·복호화합니다.
     */
    public static void pullRemoteAsync(Context ctx, Runnable onUiUpdated) {
        if (ctx == null) return;
        long now = System.currentTimeMillis();
        if (now - sLastPullAtMs < 1200L) return;
        sLastPullAtMs = now;

        final Context appCtx = ctx.getApplicationContext();
        IO_EXECUTOR.execute(() -> {
            try {
                SharedPreferences prefs = appCtx.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
                String email = prefs.getString("email", "");
                String uid = prefs.getString("canonicalUserId", "");
                String hubToken = prefs.getString("hubToken", "");
                String endpoint = prefs.getString("bridgeUrl", DEFAULT_BRIDGE_URL);
                if (email.isEmpty() || hubToken.isEmpty()) return;

                JSONObject req = new JSONObject();
                req.put("action", "device_pull_e2ee_clips");
                JSONObject resp = postBridgeJson(endpoint, hubToken, req);
                if (resp == null || !resp.optBoolean("ok", false)) return;

                String serverUid = resp.optString("canonicalUserId", "").trim();
                if (!serverUid.isEmpty() && !serverUid.equals(uid)) {
                    prefs.edit().putString("canonicalUserId", serverUid).apply();
                }
                String effectiveUid = !serverUid.isEmpty() ? serverUid : uid;
                if (effectiveUid.isEmpty()) return;

                JSONArray rawItems = resp.optJSONArray("items");
                if (rawItems == null || rawItems.length() == 0) return;

                SecretKey primaryKey = deriveAesKey(email, effectiveUid);
                SecretKey fallbackKey = (!uid.isEmpty() && !uid.equals(effectiveUid))
                    ? deriveAesKey(email, uid)
                    : null;

                JSONArray decrypted = new JSONArray();
                int limit = Math.min(rawItems.length(), 120);
                for (int i = 0; i < limit; i++) {
                    JSONObject env = rawItems.optJSONObject(i);
                    if (env == null) continue;
                    String cipherB64 = env.optString("cipherB64", "");
                    String ivB64 = env.optString("ivB64", "");
                    if (cipherB64.isEmpty() || ivB64.isEmpty()) continue;

                    String plain = tryDecrypt(primaryKey, cipherB64, ivB64);
                    if (plain == null && fallbackKey != null) {
                        plain = tryDecrypt(fallbackKey, cipherB64, ivB64);
                    }
                    if (plain == null || plain.trim().isEmpty()) continue;

                    JSONObject item = new JSONObject();
                    item.put("clipHash", env.optString("clipHash", GhostiSharedClipboardStore.sha256Hex(plain.trim())));
                    item.put("text", plain.trim());
                    item.put("senderName", env.optString("senderName", "연결된 내 기기"));
                    item.put("createdAt", env.optString("createdAt", GhostiSharedClipboardStore.formatIsoUtc(System.currentTimeMillis())));
                    decrypted.put(item);
                }

                if (decrypted.length() > 0) {
                    GhostiSharedClipboardStore.mergeFromWebHistory(appCtx, decrypted);
                    if (onUiUpdated != null) {
                        new Handler(Looper.getMainLooper()).post(onUiUpdated);
                    }
                }
            } catch (Throwable ignored) {
            }
        });
    }

    private static String tryDecrypt(SecretKey key, String cipherB64, String ivB64) {
        try {
            byte[] iv = Base64.decode(ivB64, Base64.DEFAULT);
            byte[] cipherBytes = Base64.decode(cipherB64, Base64.DEFAULT);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] plainBytes = cipher.doFinal(cipherBytes);
            return new String(plainBytes, StandardCharsets.UTF_8);
        } catch (Throwable ignored) {
            return null;
        }
    }
}
