package app.sundreamer.ghosti;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * [Ghosti 3귀신] Android 공용 7일(168시간) · 최대 500건 클립보드 저장소
 * - 본체 WebView(GhostiMobileCarePlugin), 입력기 키보드(GhostiClipboardImeService),
 *   텍스트 선택/공유 직결(GhostiQuickClipActivity) 3곳이 단일 SharedPreferences를 공유합니다.
 * - 앱을 열지 않은 상태에서 캡처된 항목은 pending_outbound_json에 적재되어
 *   본체 앱이 활성화되거나 WebView가 살아있는 즉시 E2EE로 PC에 자동 전송됩니다.
 */
public final class GhostiSharedClipboardStore {
    public static final String PREFS_NAME = "ghosti_shared_clipboard_7d";
    private static final String KEY_HISTORY = "history_json";
    private static final String KEY_PENDING_OUTBOUND = "pending_outbound_json";
    private static final String KEY_SEQ_INDEX = "seq_paste_index";

    public static final long RETENTION_MS = 7L * 24L * 3600L * 1000L; // 7일(168시간)
    public static final int MAX_ITEMS = 500;

    public static final class ClipEntry {
        public final String clipHash;
        public final String text;
        public final String senderName;
        public final String createdAt;
        public final long createdAtMs;

        public ClipEntry(String clipHash, String text, String senderName, String createdAt, long createdAtMs) {
            this.clipHash = clipHash;
            this.text = text;
            this.senderName = senderName;
            this.createdAt = createdAt;
            this.createdAtMs = createdAtMs;
        }

        public JSONObject toJson() {
            JSONObject obj = new JSONObject();
            try {
                obj.put("clipHash", clipHash);
                obj.put("text", text);
                obj.put("senderName", senderName);
                obj.put("createdAt", createdAt);
                obj.put("createdAtMs", createdAtMs);
            } catch (Throwable ignored) {
            }
            return obj;
        }
    }

    private GhostiSharedClipboardStore() {}

    public static String sha256Hex(String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] dig = md.digest((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(dig.length * 2);
            for (byte b : dig) {
                sb.append(String.format(Locale.US, "%02x", b));
            }
            return sb.toString();
        } catch (Throwable t) {
            return String.valueOf((text == null ? "" : text).hashCode());
        }
    }

    public static String formatIsoUtc(long epochMs) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date(epochMs));
    }

    public static String defaultDeviceLabel() {
        String model = Build.MODEL != null ? Build.MODEL.trim() : "안드로이드";
        return model.isEmpty() ? "안드로이드" : model;
    }

    private static long parseCreatedAtMs(JSONObject obj, long fallbackMs) {
        long ms = obj.optLong("createdAtMs", 0L);
        if (ms > 0L) return ms;
        String iso = obj.optString("createdAt", "");
        if (iso != null && !iso.isEmpty()) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date d = sdf.parse(iso);
                if (d != null) return d.getTime();
            } catch (Throwable ignored) {
            }
            try {
                SimpleDateFormat sdf2 = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                sdf2.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date d2 = sdf2.parse(iso);
                if (d2 != null) return d2.getTime();
            } catch (Throwable ignored) {
            }
        }
        return fallbackMs;
    }

    public static synchronized List<ClipEntry> loadHistory(Context ctx) {
        List<ClipEntry> out = new ArrayList<>();
        if (ctx == null) return out;
        try {
            SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_HISTORY, "[]");
            JSONArray arr = new JSONArray(raw != null ? raw : "[]");
            long now = System.currentTimeMillis();
            long cutoff = now - RETENTION_MS;
            Set<String> seen = new HashSet<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj == null) continue;
                String text = obj.optString("text", "").trim();
                if (text.isEmpty()) continue;
                long ts = parseCreatedAtMs(obj, now);
                if (ts > 0L && ts < cutoff) continue;
                String hash = obj.optString("clipHash", "");
                if (hash.isEmpty()) hash = sha256Hex(text);
                if (!seen.add(hash)) continue;
                String sender = obj.optString("senderName", defaultDeviceLabel());
                String iso = obj.optString("createdAt", formatIsoUtc(ts));
                out.add(new ClipEntry(hash, text, sender, iso, ts));
                if (out.size() >= MAX_ITEMS) break;
            }
        } catch (Throwable ignored) {
        }
        return out;
    }

    private static synchronized void saveHistoryLocked(Context ctx, List<ClipEntry> list) {
        if (ctx == null) return;
        try {
            JSONArray arr = new JSONArray();
            long now = System.currentTimeMillis();
            long cutoff = now - RETENTION_MS;
            Set<String> seen = new HashSet<>();
            int count = 0;
            for (ClipEntry e : list) {
                if (e == null || e.text == null || e.text.trim().isEmpty()) continue;
                if (e.createdAtMs > 0L && e.createdAtMs < cutoff) continue;
                if (!seen.add(e.clipHash)) continue;
                arr.put(e.toJson());
                count++;
                if (count >= MAX_ITEMS) break;
            }
            SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_HISTORY, arr.toString()).apply();
        } catch (Throwable ignored) {
        }
    }

    /**
     * 외부 입력창(IME 키보드 / 텍스트 선택 / 공유 시트)에서 캡처된 텍스트를
     * 7일 히스토리 최상단에 즉시 누적하고 PC E2EE 발신 대기열에도 등록합니다.
     */
    public static synchronized ClipEntry pushLocalCapturedClip(Context ctx, String rawText, String sourceLabel) {
        if (ctx == null || rawText == null) return null;
        String clean = rawText.trim();
        if (clean.isEmpty()) return null;
        if (clean.length() > 16000) {
            clean = clean.substring(0, 16000);
        }
        long now = System.currentTimeMillis();
        String hash = sha256Hex(clean);
        String iso = formatIsoUtc(now);
        String sender = (sourceLabel != null && !sourceLabel.trim().isEmpty())
            ? sourceLabel.trim()
            : defaultDeviceLabel();

        ClipEntry entry = new ClipEntry(hash, clean, sender, iso, now);
        List<ClipEntry> current = loadHistory(ctx);
        List<ClipEntry> merged = new ArrayList<>();
        merged.add(entry);
        for (ClipEntry old : current) {
            if (!hash.equals(old.clipHash)) {
                merged.add(old);
            }
        }
        saveHistoryLocked(ctx, merged);

        // 1→2→3 순차 붙여넣기 인덱스 리셋
        resetSequentialIndex(ctx);

        // PC 전송 대기열(pending_outbound)에 추가
        try {
            SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            JSONArray pending = new JSONArray(prefs.getString(KEY_PENDING_OUTBOUND, "[]"));
            JSONArray nextPending = new JSONArray();
            nextPending.put(entry.toJson());
            for (int i = 0; i < pending.length() && nextPending.length() < 60; i++) {
                JSONObject o = pending.optJSONObject(i);
                if (o != null && !hash.equals(o.optString("clipHash", ""))) {
                    nextPending.put(o);
                }
            }
            prefs.edit().putString(KEY_PENDING_OUTBOUND, nextPending.toString()).apply();
        } catch (Throwable ignored) {
        }

        // 본체 WebView가 살아 있으면 즉시 JS 이벤트로 알림 (0.05초 PC E2EE 전송)
        GhostiMobileCarePlugin.notifyNativeClipboardCaptured(entry);
        return entry;
    }

    /**
     * 본체 JS(deviceIntegrationService)에서 PC+폰 동기화된 7일 치 목록을 내려받아 병합 저장합니다.
     */
    public static synchronized int mergeFromWebHistory(Context ctx, JSONArray incoming) {
        if (ctx == null || incoming == null) return 0;
        long now = System.currentTimeMillis();
        long cutoff = now - RETENTION_MS;
        List<ClipEntry> existing = loadHistory(ctx);
        List<ClipEntry> merged = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (int i = 0; i < incoming.length(); i++) {
            JSONObject o = incoming.optJSONObject(i);
            if (o == null) continue;
            String text = o.optString("text", "").trim();
            if (text.isEmpty()) continue;
            long ts = parseCreatedAtMs(o, now);
            if (ts > 0L && ts < cutoff) continue;
            String hash = o.optString("clipHash", "");
            if (hash.isEmpty()) hash = sha256Hex(text);
            if (!seen.add(hash)) continue;
            String sender = o.optString("senderName", "연결된 내 기기");
            String iso = o.optString("createdAt", formatIsoUtc(ts));
            merged.add(new ClipEntry(hash, text, sender, iso, ts));
            if (merged.size() >= MAX_ITEMS) break;
        }
        for (ClipEntry old : existing) {
            if (merged.size() >= MAX_ITEMS) break;
            if (seen.add(old.clipHash)) {
                merged.add(old);
            }
        }
        saveHistoryLocked(ctx, merged);
        return merged.size();
    }

    public static synchronized JSONArray consumePendingOutbound(Context ctx) {
        JSONArray empty = new JSONArray();
        if (ctx == null) return empty;
        try {
            SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING_OUTBOUND, "[]");
            JSONArray arr = new JSONArray(raw != null ? raw : "[]");
            if (arr.length() > 0) {
                prefs.edit().putString(KEY_PENDING_OUTBOUND, "[]").apply();
            }
            return arr;
        } catch (Throwable ignored) {
            return empty;
        }
    }

    public static synchronized int nextSequentialIndex(Context ctx, int listSize) {
        if (ctx == null || listSize <= 0) return 0;
        SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int idx = prefs.getInt(KEY_SEQ_INDEX, 0);
        if (idx < 0 || idx >= listSize) idx = 0;
        int next = (idx + 1) % listSize;
        prefs.edit().putInt(KEY_SEQ_INDEX, next).apply();
        return idx;
    }

    public static synchronized void resetSequentialIndex(Context ctx) {
        if (ctx == null) return;
        SharedPreferences prefs = ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt(KEY_SEQ_INDEX, 0).apply();
    }
}
