package app.sundreamer.ghosti;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Base64;
import android.util.Log;
import androidx.core.app.NotificationCompat;
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
import java.util.HashSet;
import java.util.Set;
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
 * [Ghosti 3귀신] Android 무화면 OS 직송(텍스트·사진) & PC➔폰 선택 전송 푸시([📋 복사] 1탭) 엔진
 * 1) 폰 ➔ PC: [PC로 보내기] 텍스트 및 [공유 ➔ 귀신같이] 사진을 앱 오픈 없이 백그라운드 스레드에서 PC Ctrl+V로 직송
 * 2) PC ➔ 폰: PC에서 평소 Ctrl+C 시에는 알림 0건, 명시적으로 [📱 폰으로 보내기] 클릭 시에만 상단 알림바에
 *    [📋 복사] 액션 버튼이 달린 푸시 알림 1건을 띄워 앱을 열지 않고 그 자리에서 즉시 복사!
 */
public final class GhostiNativeClipboardSync {
    private static final String AUTH_PREFS = "ghosti_native_clip_auth_v1";
    private static final String PUSH_STATE_PREFS = "ghosti_phone_push_inbox_state_v1";
    private static final String CHANNEL_PC_CLIP_PUSH = "ghosti_pc_clip_push_v2";
    private static final String DEFAULT_BRIDGE_URL =
        "https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge";

    private static final ExecutorService IO_EXECUTOR = Executors.newSingleThreadExecutor();
    private static final ExecutorService PUSH_PULL_EXECUTOR = Executors.newSingleThreadExecutor();
    private static final ConcurrentHashMap<String, SecretKey> KEY_CACHE = new ConcurrentHashMap<>();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static volatile long sLastPullAtMs = 0L;
    private static volatile long sPushInboxSinceMs = System.currentTimeMillis() - 10 * 60_000L;
    private static volatile long sLastWatcherHeartbeatMs = 0L;
    private static volatile Thread sActiveWatcherThread = null;
    private static volatile boolean sScreenReceiverRegistered = false;
    private static final Set<String> MEMORY_SEEN_PUSH_IDS = new HashSet<>();

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

        if (!normUid.isEmpty()) {
            IO_EXECUTOR.execute(() -> {
                try {
                    deriveAesKey(normEmail, normUid);
                } catch (Throwable ignored) {
                }
            });
        }
        Context appCtx = ctx.getApplicationContext();
        ensurePhonePushWatcherAlive(appCtx);
        checkPhonePushInboxNow(appCtx);
        GhostiPushKeepAliveJobService.scheduleNext(appCtx, 15_000L);
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

    private static JSONObject postBridgeJson(String endpoint, String hubToken, JSONObject body, int readTimeoutMs) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(readTimeoutMs);
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
     * 외부 앱([PC로 보내기] 텍스트 선택 / 공유 시트)에서 캡처한 텍스트를 본체 앱 실행 없이 PC로 직통 E2EE 전송합니다.
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

                JSONObject resp = postBridgeJson(endpoint, hubToken, req, 8000);
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
     * 갤러리·카톡에서 [공유 ➔ 귀신같이] 선택 시 본체 앱을 열지 않고 사진을 PC Ctrl+V로 직송합니다.
     */
    public static boolean pushPhotoToPcSync(
        Context ctx,
        byte[] imageBytes,
        String fileName,
        String mimeType,
        int width,
        int height
    ) {
        if (ctx == null || imageBytes == null || imageBytes.length == 0) return false;
        try {
            Context appCtx = ctx.getApplicationContext();
            SharedPreferences prefs = appCtx.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
            String email = prefs.getString("email", "");
            String hubToken = prefs.getString("hubToken", "");
            String devId = prefs.getString("deviceId", "");
            String devName = prefs.getString("deviceName", GhostiSharedClipboardStore.defaultDeviceLabel());
            String endpoint = prefs.getString("bridgeUrl", DEFAULT_BRIDGE_URL);
            if (email.isEmpty() || hubToken.isEmpty()) return false;

            JSONObject req = new JSONObject();
            req.put("action", "device_push_photo_to_pc");
            req.put("fileName", fileName != null && !fileName.isEmpty() ? fileName : "phone_share.jpg");
            req.put("mimeType", mimeType != null && !mimeType.isEmpty() ? mimeType : "image/jpeg");
            req.put("imageBase64", Base64.encodeToString(imageBytes, Base64.NO_WRAP));
            req.put("width", width);
            req.put("height", height);
            req.put("senderDeviceId", devId.isEmpty() ? "android-native-direct" : devId);
            req.put("senderName", devName);

            JSONObject resp = postBridgeJson(endpoint, hubToken, req, 18000);
            return resp != null && resp.optBoolean("ok", false);
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static synchronized void registerScreenWakeReceiverIfNeeded(Context appCtx) {
        if (appCtx == null || sScreenReceiverRegistered) return;
        sScreenReceiverRegistered = true;
        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_SCREEN_ON);
            filter.addAction(Intent.ACTION_USER_PRESENT);
            BroadcastReceiver wakeReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (context == null) return;
                    ensurePhonePushWatcherAlive(context.getApplicationContext());
                    checkPhonePushInboxNow(context.getApplicationContext());
                }
            };
            if (Build.VERSION.SDK_INT >= 33) {
                appCtx.registerReceiver(wakeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                appCtx.registerReceiver(wakeReceiver, filter);
            }
        } catch (Throwable ignored) {
        }
    }

    public static void startPhonePushInboxWatcher(Context ctx) {
        ensurePhonePushWatcherAlive(ctx);
    }

    /**
     * PC에서 [📱 폰으로 보내기] 클릭 시 도착한 선택 전송 패킷을 감지하여 상단 알림바에 [📋 복사] 버튼 알림 1건을 띄웁니다.
     * - 캐시 프리저/프로세스 회수 이후에도 하트비트 기반으로 워처 스레드를 자동 복구하며, 화면 켜짐 시 즉시 확인합니다.
     */
    public static synchronized void ensurePhonePushWatcherAlive(Context ctx) {
        if (ctx == null) return;
        final Context appCtx = ctx.getApplicationContext();
        ensurePcClipPushChannel(appCtx);
        registerScreenWakeReceiverIfNeeded(appCtx);

        long now = System.currentTimeMillis();
        Thread existing = sActiveWatcherThread;
        if (existing != null && existing.isAlive() && (now - sLastWatcherHeartbeatMs) < 12_000L) {
            return;
        }

        sLastWatcherHeartbeatMs = now;
        Thread watcher = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                sLastWatcherHeartbeatMs = System.currentTimeMillis();
                try {
                    PowerManager pm = (PowerManager) appCtx.getSystemService(Context.POWER_SERVICE);
                    boolean screenOn = (pm == null) || pm.isInteractive();
                    if (!screenOn) {
                        Thread.sleep(4000L);
                        continue;
                    }
                    checkPhonePushInboxSync(appCtx);
                } catch (InterruptedException ie) {
                    break;
                } catch (Throwable ignored) {
                }
                try {
                    Thread.sleep(1400L);
                } catch (InterruptedException ie) {
                    break;
                }
            }
        }, "ghosti-phone-push-watcher");
        watcher.setDaemon(true);
        sActiveWatcherThread = watcher;
        watcher.start();
    }

    public static void checkPhonePushInboxNow(Context ctx) {
        if (ctx == null) return;
        final Context appCtx = ctx.getApplicationContext();
        PUSH_PULL_EXECUTOR.execute(() -> checkPhonePushInboxSync(appCtx));
    }

    public static void checkPhonePushInboxSync(Context appCtx) {
        if (appCtx == null) return;
        try {
            SharedPreferences authPrefs = appCtx.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
            String email = authPrefs.getString("email", "");
            String uid = authPrefs.getString("canonicalUserId", "");
            String hubToken = authPrefs.getString("hubToken", "");
            String devId = authPrefs.getString("deviceId", "");
            String endpoint = authPrefs.getString("bridgeUrl", DEFAULT_BRIDGE_URL);
            if (email.isEmpty() || hubToken.isEmpty()) {
                return;
            }
            long windowFloor = System.currentTimeMillis() - 10 * 60_000L;
            long querySince = Math.max(windowFloor, sPushInboxSinceMs - 2000L);

            JSONObject req = new JSONObject();
            req.put("action", "device_pull_phone_push_inbox");
            req.put("sinceMs", querySince);
            req.put("callerDeviceId", devId);
            JSONObject resp = postBridgeJson(endpoint, hubToken, req, 6000);
            if (resp == null || !resp.optBoolean("ok", false)) {
                return;
            }
            String srvUid = resp.optString("canonicalUserId", "").trim();
            String prevUid = uid;
            if (!srvUid.isEmpty() && !srvUid.equals(uid)) {
                authPrefs.edit().putString("canonicalUserId", srvUid).apply();
                uid = srvUid;
            }
            JSONArray items = resp.optJSONArray("items");
            if (items == null || items.length() == 0 || uid.isEmpty()) {
                return;
            }
            SecretKey primaryKey = deriveAesKey(email, uid);
            SecretKey fallbackKey = (!prevUid.isEmpty() && !prevUid.equals(uid))
                ? deriveAesKey(email, prevUid)
                : null;
            for (int i = items.length() - 1; i >= 0; i--) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                String pushId = it.optString("pushId", "").trim();
                long createdAtMs = it.optLong("createdAtMs", 0L);
                if (createdAtMs > sPushInboxSinceMs) {
                    sPushInboxSinceMs = createdAtMs;
                }
                if (pushId.isEmpty() || isPushIdAlreadyNotified(appCtx, pushId)) continue;

                String cB64 = it.optString("cipherB64", "");
                String ivB64 = it.optString("ivB64", "");
                String plain = tryDecrypt(primaryKey, cB64, ivB64);
                if (plain == null && fallbackKey != null) {
                    plain = tryDecrypt(fallbackKey, cB64, ivB64);
                }
                if (plain != null && !plain.trim().isEmpty()) {
                    postOneTapCopyNotification(
                        appCtx,
                        pushId,
                        plain.trim(),
                        it.optString("senderName", "내 PC")
                    );
                }
            }
        } catch (Throwable ignored) {
        }
    }

    private static synchronized boolean isPushIdAlreadyNotified(Context appCtx, String pushId) {
        if (appCtx == null || pushId == null || pushId.trim().isEmpty()) return false;
        String cleanId = pushId.trim();
        if (MEMORY_SEEN_PUSH_IDS.contains(cleanId)) return true;
        SharedPreferences stPrefs = appCtx.getSharedPreferences(PUSH_STATE_PREFS, Context.MODE_PRIVATE);
        Set<String> seenSet = stPrefs.getStringSet("seen_ids", null);
        if (seenSet != null && seenSet.contains(cleanId)) {
            MEMORY_SEEN_PUSH_IDS.add(cleanId);
            return true;
        }
        return false;
    }

    private static synchronized boolean markPushIdNotified(Context appCtx, String pushId) {
        if (appCtx == null || pushId == null || pushId.trim().isEmpty()) return true;
        String cleanId = pushId.trim();
        if (MEMORY_SEEN_PUSH_IDS.contains(cleanId)) {
            return false;
        }
        SharedPreferences stPrefs = appCtx.getSharedPreferences(PUSH_STATE_PREFS, Context.MODE_PRIVATE);
        Set<String> seenSet = new HashSet<>(stPrefs.getStringSet("seen_ids", new HashSet<>()));
        if (seenSet.contains(cleanId)) {
            MEMORY_SEEN_PUSH_IDS.add(cleanId);
            return false;
        }
        MEMORY_SEEN_PUSH_IDS.add(cleanId);
        seenSet.add(cleanId);
        if (seenSet.size() > 80) {
            Set<String> trimmed = new HashSet<>();
            int k = 0;
            for (String id : seenSet) {
                trimmed.add(id);
                if (++k >= 50) break;
            }
            trimmed.add(cleanId);
            seenSet = trimmed;
        }
        stPrefs.edit().putStringSet("seen_ids", seenSet).commit();
        return true;
    }

    public static void ensurePcClipPushChannel(Context appCtx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || appCtx == null) return;
        try {
            NotificationManager nm = (NotificationManager) appCtx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_PC_CLIP_PUSH,
                "PC에서 보낸 클립보드",
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("PC에서 [폰으로 보내기]를 눌렀을 때 상단 알림의 [복사] 버튼 1탭으로 앱을 열지 않고 복사합니다.");
            ch.enableVibration(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        } catch (Throwable t) {
            Log.w("GhostiClipPush", "ensurePcClipPushChannel failed", t);
        }
    }

    public static void postOneTapCopyNotification(Context appCtx, String pushId, String plainText, String senderName) {
        if (appCtx == null || plainText == null || plainText.trim().isEmpty()) return;
        try {
            if (pushId != null && !pushId.trim().isEmpty() && !markPushIdNotified(appCtx, pushId)) {
                return;
            }
            ensurePcClipPushChannel(appCtx);
            NotificationManager nm = (NotificationManager) appCtx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            int notifId = Math.abs((pushId != null && !pushId.isEmpty() ? pushId : plainText).hashCode() & 0x0FFFFFFF) + 51000;
            Intent copyIntent = new Intent(appCtx, GhostiNotificationCopyActivity.class);
            copyIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            copyIntent.putExtra(GhostiNotificationCopyActivity.EXTRA_CLIP_TEXT, plainText);
            copyIntent.putExtra(GhostiNotificationCopyActivity.EXTRA_NOTIFICATION_ID, notifId);

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent copyPendingIntent = PendingIntent.getActivity(appCtx, notifId, copyIntent, piFlags);

            String oneLinePreview = plainText.replace('\n', ' ').trim();
            if (oneLinePreview.length() > 96) {
                oneLinePreview = oneLinePreview.substring(0, 96) + "…";
            }
            String cleanSender = (senderName != null && !senderName.trim().isEmpty()) ? senderName.trim() : "내 PC";

            NotificationCompat.Action copyAction = new NotificationCompat.Action.Builder(
                0,
                "📋 복사",
                copyPendingIntent
            ).build();

            NotificationCompat.Builder builder = new NotificationCompat.Builder(appCtx, CHANNEL_PC_CLIP_PUSH)
                .setSmallIcon(R.drawable.ic_stat_ghosti_clip)
                .setContentTitle("📋 " + cleanSender + "에서 보낸 클립보드")
                .setContentText(oneLinePreview)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(oneLinePreview))
                .setContentIntent(copyPendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .addAction(copyAction);

            nm.notify(notifId, builder.build());
        } catch (Throwable t) {
            Log.e("GhostiClipPush", "postOneTapCopyNotification failed", t);
        }
    }

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
                JSONObject resp = postBridgeJson(endpoint, hubToken, req, 8000);
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
