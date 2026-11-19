package app.sundreamer.ghosti;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Size;

import java.io.ByteArrayOutputStream;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(
    name = "GhostiMobileCare",
    permissions = {
        @Permission(
            alias = "mediaModern",
            strings = {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            }
        ),
        @Permission(
            alias = "mediaLegacy",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
        )
    }
)
public class GhostiMobileCarePlugin extends Plugin {

    private static final String[] TARGET_BLOAT_PACKAGES = new String[] {
        // 1순위: CleanX (TapSuite) 및 변종 주간구독 유도 클리너 패밀리
        "com.xstudios.cleanx",
        "com.tapsuite.cleanx",
        "com.cleanx.storage.cleaner",
        "com.cleanx.phone.cleaner",
        "com.storage.cleaner.cleanx",
        "com.smart.cleaner.cleanx",

        // 2순위: 주간/월간 고액 자동결제 유도(Fleeceware) 및 광고폭탄 폰 클리너·부스터 대표 패키지
        "com.fancyclean.security.antivirus",
        "com.fancyclean.booster",
        "com.fancybattery.cleaner.security",
        "com.bravo.cleaner",
        "com.bravo.security",
        "com.noxgroup.app.cleaner",
        "com.noxgroup.app.security",
        "com.oneapp.max.cleaner.booster",
        "com.oneapp.max.security.pro",
        "com.lionmobi.powerclean",
        "com.cleanmaster.mguard",
        "com.cleanmaster.security",
        "com.piriform.ccleaner",
        "com.avg.cleaner",
        "com.avast.android.cleaner",
        "com.nortonmobile.nortonclean",
        "com.symantec.cleansweep",
        "com.allgoritm.youla.cleaner",
        "com.supercleaner.phone.booster",
        "com.speedbooster.junk.cleaner",
        "com.rocket.cleaner.booster",
        "com.hyper.cleaner.booster",
        "com.fast.cleaner.battery.saver",
        "com.phone.cleaner.antivirus.speed.booster",
        "com.master.cleaner.phone.booster",
        "com.smart.phone.cleaner.booster",
        "com.easy.cleaner.junk.remover",
        "com.deep.cleaner.storage.booster",
        "com.power.cleaner.antivirus",
        "com.space.cleaner.junk.removal",
        "com.storage.analyzer.cleaner",
        "com.duplicate.photo.remover.cleaner",
        "com.photo.cleaner.duplicate.finder",
        "com.ai.cleaner.storage.master",
        "com.ai.photo.cleaner.swipe",
        "com.swipe.photo.cleaner",
        "com.cleanup.phone.storage.cleaner",
        "com.cleaner.guru.storage.clean",
        "com.smartcleaner.storage.clean",
        "com.phonecleaner.smart.boost",
        "com.junkcleaner.phone.cooler",
        "com.cpucooler.phone.cleaner",
        "com.batterysaver.fast.charger.cleaner",
        "com.rambooster.memory.cleaner",
        "com.viruscleaner.security.antivirus",
        "com.keepclean.cleaner.antivirus",
        "com.apps.keepclean",
        "com.alphacleaner.phone.booster",
        "com.turbocleaner.booster.clean",
        "com.maxcleaner.phone.antivirus",
        "com.acecleaner.phone.booster",
        "com.goclean.phone.cleaner",
        "com.iclean.master.boost",
        "com.ora.phone.cleaner",
        "com.orasecurity.antivirus.cleaner",
        "com.lark.cleaner.storage",
        "com.flash.cleaner.booster",
        "com.zero.cleaner.junk",
        "com.Dr.Clean.Phone.Cleaner",
        "com.drcleaner.storage.boost",
        "com.hawk.security",
        "com.duapps.cleaner",
        "com.qihoo.security",
        "com.tencent.qqpimsecure",
        "com.psafe.msuite",
        "com.ancleaner.android.cleaner",
        "com.systweak.systemoptimizer",
        "com.nero.tuneitup",
        "com.dfndr.security.cleaner",
        "com.mobikeeper.cleaner.booster",
        "com.topcleaner.phone.clean",
        "com.starcleaner.junk.clean",
        "com.zen.cleaner.booster",
        "com.pure.cleaner.booster",
        "com.mint.cleaner.storage",
        "com.nova.cleaner.booster",
        "com.prime.cleaner.junk",
        "com.ultra.cleaner.booster",
        "com.pro.cleaner.storage",
        "com.lite.cleaner.booster",
        "com.quick.cleaner.junk",
        "com.daily.cleaner.phone",
        "com.auto.cleaner.memory",
        "com.kr.smartcleaner",
        "kr.co.smartcleaner",
        "com.korea.phonecleaner"
    };

    private static final String[] STORAGE_CLEANER_INTENT_ACTIONS = new String[] {
        "android.os.storage.action.CLEAR_APP_CACHE",
        "android.os.storage.action.MANAGE_STORAGE",
        "android.intent.action.MANAGE_PACKAGE_STORAGE"
    };

    private boolean isSuspiciousCleanerKeyword(String pkgOrLabel) {
        if (pkgOrLabel == null) return false;
        String low = pkgOrLabel.toLowerCase(Locale.ROOT);
        return low.contains("clean")
            || low.contains("boost")
            || low.contains("junk")
            || low.contains("cooler")
            || low.contains("optimizer")
            || low.contains("클리너")
            || low.contains("청소")
            || low.contains("부스터");
    }

    @PluginMethod
    public void scanInstalledBloatCleaners(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        Set<String> candidatePackages = new LinkedHashSet<>(Arrays.asList(TARGET_BLOAT_PACKAGES));
        Map<String, String> customRiskByPkg = new HashMap<>();

        // 1) 웹 원격 DB(public/mobile_bloat_cleaners_db.json)에서 실시간 전달된 신종 패키지 병합
        try {
            JSArray extraPackages = call.getArray("extraPackages");
            if (extraPackages != null) {
                for (int i = 0; i < extraPackages.length(); i++) {
                    String extraPkg = extraPackages.optString(i, "").trim();
                    if (!extraPkg.isEmpty()) {
                        candidatePackages.add(extraPkg);
                    }
                }
            }
            JSObject customRiskMap = call.getObject("customRiskMap");
            if (customRiskMap != null) {
                JSONArray keys = customRiskMap.names();
                if (keys != null) {
                    for (int i = 0; i < keys.length(); i++) {
                        String k = keys.optString(i, "");
                        String v = customRiskMap.optString(k, "");
                        if (!k.isEmpty() && !v.isEmpty()) {
                            customRiskByPkg.put(k, v);
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 2) <queries>의 <intent> 시그니처를 통해 노출된 신종 서드파티 클리너 패키지 자동 포착
        for (String action : STORAGE_CLEANER_INTENT_ACTIONS) {
            try {
                Intent queryIntent = new Intent(action);
                List<ResolveInfo> resolved = pm.queryIntentActivities(queryIntent, 0);
                if (resolved != null) {
                    for (ResolveInfo ri : resolved) {
                        if (ri.activityInfo == null || ri.activityInfo.packageName == null) continue;
                        String foundPkg = ri.activityInfo.packageName;
                        ApplicationInfo ai = ri.activityInfo.applicationInfo;
                        boolean isSystemApp = ai != null && ((ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                            || (ai.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0);
                        if (isSystemApp || foundPkg.startsWith("app.sundreamer.") || foundPkg.startsWith("com.android.") || foundPkg.startsWith("com.google.android.")) {
                            continue;
                        }
                        String label = ai != null ? String.valueOf(pm.getApplicationLabel(ai)) : foundPkg;
                        if (isSuspiciousCleanerKeyword(foundPkg) || isSuspiciousCleanerKeyword(label)) {
                            candidatePackages.add(foundPkg);
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }

        JSArray detected = new JSArray();
        for (String pkg : candidatePackages) {
            try {
                PackageInfo info = pm.getPackageInfo(pkg, 0);
                if (info != null) {
                    ApplicationInfo appInfo = info.applicationInfo;
                    String appLabel = appInfo != null ? String.valueOf(pm.getApplicationLabel(appInfo)) : pkg;
                    boolean isCleanX = pkg.toLowerCase(Locale.ROOT).contains("cleanx");
                    boolean isSubTrap = isCleanX
                        || pkg.contains("guru")
                        || pkg.contains("swipe")
                        || pkg.contains("ai.cleaner");
                    String customRisk = customRiskByPkg.get(pkg);
                    String riskSummary = (customRisk != null && !customRisk.isEmpty())
                        ? customRisk
                        : isCleanX
                        ? "🚨 [구독함정·권한침투] 3일 무료체험 후 주 13,000원(월 52,000원) 자동결제 유도 및 Google 계정 데이터 접근 권한 위험"
                        : "⚠️ [애드웨어·구독함정] 불필요한 광고 팝업·백그라운드 배터리 소모 및 유료 구독 유도 위험 청소앱";

                    JSObject item = new JSObject();
                    item.put("packageName", pkg);
                    item.put("appName", appLabel);
                    item.put("versionName", info.versionName != null ? info.versionName : "");
                    item.put("isSubscriptionTrap", isSubTrap);
                    item.put("riskSummaryKo", riskSummary);
                    detected.put(item);
                }
            } catch (PackageManager.NameNotFoundException ignored) {
                // 미설치 패키지 무시
            } catch (Exception ignored) {
            }
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("scannedCount", candidatePackages.size());
        ret.put("detected", detected);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppUninstallScreen(PluginCall call) {
        String pkg = call.getString("packageName", "com.xstudios.cleanx");
        Context context = getContext();
        try {
            Intent detailsIntent = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + pkg)
            );
            detailsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(detailsIntent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("packageName", pkg);
            ret.put("mode", "app_details");
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent delIntent = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg));
                delIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(delIntent);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("packageName", pkg);
                ret.put("mode", "action_delete");
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("UNINSTALL_SCREEN_FAILED: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void openPlayStoreSubscriptions(PluginCall call) {
        String pkg = call.getString("packageName", "");
        Context context = getContext();
        String url = (pkg != null && !pkg.trim().isEmpty())
            ? "https://play.google.com/store/account/subscriptions?package=" + Uri.encode(pkg.trim())
            : "https://play.google.com/store/account/subscriptions";
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("url", url);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("OPEN_SUBSCRIPTIONS_FAILED: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openGoogleAccountPermissions(PluginCall call) {
        Context context = getContext();
        String url = "https://myaccount.google.com/permissions";
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("url", url);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("OPEN_GOOGLE_PERMISSIONS_FAILED: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAllInstalledAppsSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_APPLICATIONS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("OPEN_ALL_APPS_FAILED: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void isFirebaseConfigured(PluginCall call) {
        boolean configured = false;
        try {
            Context ctx = getContext();
            int resId = ctx.getResources().getIdentifier("google_app_id", "string", ctx.getPackageName());
            if (resId != 0) {
                String appId = ctx.getString(resId);
                configured = (appId != null && !appId.trim().isEmpty());
            }
        } catch (Throwable ignored) {
            configured = false;
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("configured", configured);
        call.resolve(ret);
    }

    /**
     * [실제 OS 갤러리(삼성 갤러리·구글 포토) 휴지통 이동 및 복원 — MediaStore.createTrashRequest (API 30+)]
     * - MANAGE_EXTERNAL_STORAGE 없이 스토어 합법 표준인 MediaStore.createTrashRequest를 호출합니다.
     * - 1차: Android PhotoPicker 파일명(예: 1000008588.jpg)에서 숫자 MediaStore _ID를 직접 추출하여 권한 없이도 URI를 즉시 구성하고,
     * - 2차: 일반 파일명(예: 20261118_102030.jpg)은 DISPLAY_NAME / SIZE로 MediaStore를 쿼리해 실제 이미지 URI를 매칭합니다.
     */
    @PluginMethod
    public void requestSystemPhotoTrash(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("canceled", false);
            ret.put("doneIds", new JSArray());
            ret.put("error", "ANDROID_API_BELOW_30");
            call.resolve(ret);
            return;
        }
        executeSystemPhotoTrashInternal(call, false);
    }

    @PermissionCallback
    private void onMediaImagesPermissionForTrash(PluginCall call) {
        executeSystemPhotoTrashInternal(call, true);
    }

    private void executeSystemPhotoTrashInternal(PluginCall call, boolean permissionAlreadyRequested) {
        String action = call.getString("action", "move");
        boolean isMoveToTrash = !"restore".equalsIgnoreCase(action);
        JSArray items = call.getArray("items");
        if (items == null || items.length() == 0) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("canceled", false);
            ret.put("doneIds", new JSArray());
            call.resolve(ret);
            return;
        }

        Context ctx = getContext();
        ContentResolver resolver = ctx.getContentResolver();
        List<Uri> targetUris = new ArrayList<>();
        JSArray requestedIds = new JSArray();
        boolean needsMediaQuery = false;

        try {
            List<JSONObject> rawList = new ArrayList<>();
            for (int i = 0; i < items.length(); i++) {
                JSONObject obj = items.optJSONObject(i);
                if (obj == null) continue;
                rawList.add(obj);
                String id = obj.optString("id", "");
                String name = obj.optString("name", "");
                if (!id.isEmpty()) {
                    requestedIds.put(id);
                } else if (!name.isEmpty()) {
                    requestedIds.put(name);
                }
                Long pickerMediaId = extractNumericMediaStoreIdFromFileName(id);
                if (pickerMediaId == null) {
                    pickerMediaId = extractNumericMediaStoreIdFromFileName(name);
                }
                if (pickerMediaId == null) {
                    needsMediaQuery = true;
                }
            }

            if (needsMediaQuery && !hasMediaReadPermission(ctx) && !permissionAlreadyRequested) {
                String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "mediaModern" : "mediaLegacy";
                requestPermissionForAlias(alias, call, "onMediaImagesPermissionForTrash");
                return;
            }

            Set<Long> seenMediaIds = new LinkedHashSet<>();
            for (JSONObject obj : rawList) {
                String id = obj.optString("id", "");
                String name = obj.optString("name", "");
                long size = obj.optLong("size", -1L);
                Long mediaId = extractNumericMediaStoreIdFromFileName(id);
                if (mediaId == null) {
                    mediaId = queryMediaStoreIdForPhoto(resolver, name, size, !isMoveToTrash);
                }
                if (mediaId == null) {
                    mediaId = extractNumericMediaStoreIdFromFileName(name);
                }
                if (mediaId != null && mediaId > 0 && seenMediaIds.add(mediaId)) {
                    targetUris.add(ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId));
                }
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("canceled", false);
            ret.put("doneIds", new JSArray());
            ret.put("error", e.getMessage());
            call.resolve(ret);
            return;
        }

        if (targetUris.isEmpty()) {
            // MediaStore에서 URI를 찾지 못한 경우(예: 외부 다운로드 임시 파일) 앱 내 보관함 이동은 허용하되 플래그 반환
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("action", isMoveToTrash ? "move" : "restore");
            ret.put("canceled", false);
            ret.put("matchedMediaStoreCount", 0);
            ret.put("doneIds", requestedIds);
            call.resolve(ret);
            return;
        }

        try {
            PendingIntent pi = MediaStore.createTrashRequest(resolver, targetUris, isMoveToTrash);
            Activity act = getActivity();
            if (act instanceof MainActivity) {
                final int matchedCount = targetUris.size();
                ((MainActivity) act).launchMediaStoreIntentSender(pi.getIntentSender(), (resultCode, data) -> {
                    JSObject ret = new JSObject();
                    boolean approved = (resultCode == Activity.RESULT_OK);
                    ret.put("ok", approved);
                    ret.put("action", isMoveToTrash ? "move" : "restore");
                    ret.put("canceled", !approved);
                    ret.put("matchedMediaStoreCount", matchedCount);
                    ret.put("doneIds", approved ? requestedIds : new JSArray());
                    call.resolve(ret);
                });
            } else {
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("action", isMoveToTrash ? "move" : "restore");
                ret.put("canceled", false);
                ret.put("matchedMediaStoreCount", 0);
                ret.put("doneIds", requestedIds);
                call.resolve(ret);
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("canceled", false);
            ret.put("doneIds", new JSArray());
            ret.put("error", "CREATE_TRASH_REQUEST_FAILED: " + e.getMessage());
            call.resolve(ret);
        }
    }

    private boolean hasMediaReadPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
                || ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
        }
        return ctx.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void openAppPermissionSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent detailsIntent = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.getPackageName())
            );
            detailsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(detailsIntent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("OPEN_PERMISSION_SETTINGS_FAILED: " + e.getMessage());
        }
    }

    @PluginMethod
    public void scanDeviceGalleryMedia(PluginCall call) {
        Context ctx = getContext();
        boolean promptPerm = call.getBoolean("promptPermission", true);
        if (!hasMediaReadPermission(ctx)) {
            if (promptPerm) {
                String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "mediaModern" : "mediaLegacy";
                requestPermissionForAlias(alias, call, "onMediaPermissionForGalleryScan");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("permissionGranted", false);
            ret.put("photos", new JSArray());
            ret.put("videos", new JSArray());
            ret.put("totalPhotoCount", 0);
            call.resolve(ret);
            return;
        }
        executeGalleryMediaScanAsync(call);
    }

    @PermissionCallback
    private void onMediaPermissionForGalleryScan(PluginCall call) {
        Context ctx = getContext();
        if (!hasMediaReadPermission(ctx)) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("permissionGranted", false);
            ret.put("photos", new JSArray());
            ret.put("videos", new JSArray());
            ret.put("totalPhotoCount", 0);
            call.resolve(ret);
            return;
        }
        executeGalleryMediaScanAsync(call);
    }

    private void executeGalleryMediaScanAsync(final PluginCall call) {
        final int offset = Math.max(0, call.getInt("offset", 0));
        final int limit = Math.min(120, Math.max(1, call.getInt("limit", 60)));
        final int thumbMaxDim = Math.min(640, Math.max(240, call.getInt("thumbMaxDim", 448)));
        final boolean includeVideos = call.getBoolean("includeVideos", offset == 0);
        final Context appCtx = getContext().getApplicationContext();

        new Thread(() -> {
            ContentResolver resolver = appCtx.getContentResolver();
            JSArray photosArr = new JSArray();
            JSArray videosArr = new JSArray();
            int totalPhotoCount = 0;

            try {
                // 1) 전체 이미지 개수 확인
                String[] countProj = new String[] { MediaStore.Images.Media._ID };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Bundle cArgs = new Bundle();
                    cArgs.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_EXCLUDE);
                    try (Cursor cc = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, countProj, cArgs, null)) {
                        if (cc != null) totalPhotoCount = cc.getCount();
                    }
                } else {
                    try (Cursor cc = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, countProj, null, null, null)) {
                        if (cc != null) totalPhotoCount = cc.getCount();
                    }
                }

                // 2) 페이지네이션된 최근 사진 슬라이스 조회 + 경량 JPEG 썸네일 추출
                String[] imgProj = new String[] {
                    MediaStore.Images.Media._ID,
                    MediaStore.Images.Media.DISPLAY_NAME,
                    MediaStore.Images.Media.SIZE,
                    MediaStore.Images.Media.DATE_TAKEN,
                    MediaStore.Images.Media.DATE_MODIFIED,
                    MediaStore.Images.Media.WIDTH,
                    MediaStore.Images.Media.HEIGHT,
                    MediaStore.Images.Media.BUCKET_DISPLAY_NAME
                };

                Cursor imgCursor = null;
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        Bundle qArgs = new Bundle();
                        qArgs.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] { MediaStore.Images.Media.DATE_MODIFIED });
                        qArgs.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
                        qArgs.putInt(ContentResolver.QUERY_ARG_LIMIT, limit);
                        qArgs.putInt(ContentResolver.QUERY_ARG_OFFSET, offset);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            qArgs.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_EXCLUDE);
                        }
                        imgCursor = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, imgProj, qArgs, null);
                    } else {
                        String sortOrder = MediaStore.Images.Media.DATE_MODIFIED + " DESC";
                        imgCursor = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, imgProj, null, null, sortOrder);
                        if (imgCursor != null && offset > 0) {
                            imgCursor.moveToPosition(offset - 1);
                        }
                    }

                    int fetched = 0;
                    while (imgCursor != null && imgCursor.moveToNext() && fetched < limit) {
                        fetched++;
                        long id = imgCursor.getLong(0);
                        String name = imgCursor.getString(1);
                        long size = imgCursor.getLong(2);
                        long dateTaken = imgCursor.getLong(3);
                        long dateModSec = imgCursor.getLong(4);
                        int width = imgCursor.getInt(5);
                        int height = imgCursor.getInt(6);
                        String bucket = imgCursor.getString(7);

                        long mtimeMs = dateTaken > 100000000000L ? dateTaken : (dateModSec * 1000L);
                        Uri imgUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                        String thumbDataUrl = encodeThumbnailDataUrl(resolver, imgUri, id, false, thumbMaxDim, 78);
                        if (thumbDataUrl == null || thumbDataUrl.isEmpty()) continue;

                        boolean isScreen = (bucket != null && (bucket.toLowerCase(Locale.ROOT).contains("screenshot") || bucket.contains("스크린샷") || bucket.contains("캡처")))
                            || (name != null && (name.toLowerCase(Locale.ROOT).contains("screenshot") || name.contains("스크린샷")));

                        JSObject pObj = new JSObject();
                        pObj.put("id", "ms_img_" + id);
                        pObj.put("name", (name != null && !name.isEmpty()) ? name : ("IMG_" + id + ".jpg"));
                        pObj.put("size", size);
                        pObj.put("mtimeMs", mtimeMs);
                        pObj.put("width", width);
                        pObj.put("height", height);
                        pObj.put("bucket", bucket != null ? bucket : "");
                        pObj.put("isScreenshot", isScreen);
                        pObj.put("thumbDataUrl", thumbDataUrl);
                        photosArr.put(pObj);
                    }
                } finally {
                    if (imgCursor != null) imgCursor.close();
                }

                // 3) 첫 페이지(offset == 0) 호출 시 최근 동영상 최대 20개 자동 조회
                if (includeVideos) {
                    String[] vidProj = new String[] {
                        MediaStore.Video.Media._ID,
                        MediaStore.Video.Media.DISPLAY_NAME,
                        MediaStore.Video.Media.SIZE,
                        MediaStore.Video.Media.DURATION,
                        MediaStore.Video.Media.DATE_MODIFIED,
                        MediaStore.Video.Media.BUCKET_DISPLAY_NAME
                    };
                    Cursor vidCursor = null;
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            Bundle vArgs = new Bundle();
                            vArgs.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] { MediaStore.Video.Media.DATE_MODIFIED });
                            vArgs.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
                            vArgs.putInt(ContentResolver.QUERY_ARG_LIMIT, 20);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                vArgs.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_EXCLUDE);
                            }
                            vidCursor = resolver.query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, vidProj, vArgs, null);
                        } else {
                            vidCursor = resolver.query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, vidProj, null, null, MediaStore.Video.Media.DATE_MODIFIED + " DESC");
                        }
                        int vCount = 0;
                        while (vidCursor != null && vidCursor.moveToNext() && vCount < 20) {
                            vCount++;
                            long vid = vidCursor.getLong(0);
                            String vName = vidCursor.getString(1);
                            long vSize = vidCursor.getLong(2);
                            long durationMs = vidCursor.getLong(3);
                            long vModSec = vidCursor.getLong(4);
                            String vBucket = vidCursor.getString(5);

                            Uri vUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, vid);
                            String vThumb = encodeThumbnailDataUrl(resolver, vUri, vid, true, 480, 76);

                            JSObject vObj = new JSObject();
                            vObj.put("id", "mobile_vid_" + vid);
                            vObj.put("name", (vName != null && !vName.isEmpty()) ? vName : ("VID_" + vid + ".mp4"));
                            vObj.put("size", vSize);
                            vObj.put("durationSec", Math.max(1, Math.round(durationMs / 1000.0f)));
                            vObj.put("mtimeMs", vModSec * 1000L);
                            vObj.put("bucket", vBucket != null ? vBucket : "");
                            vObj.put("thumbDataUrl", vThumb != null ? vThumb : "");
                            videosArr.put(vObj);
                        }
                    } finally {
                        if (vidCursor != null) vidCursor.close();
                    }
                }
            } catch (Throwable ignored) {
            }

            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("permissionGranted", true);
            ret.put("offset", offset);
            ret.put("totalPhotoCount", totalPhotoCount);
            ret.put("photos", photosArr);
            ret.put("videos", videosArr);
            call.resolve(ret);
        }, "GhostiGalleryScanner").start();
    }

    private String encodeThumbnailDataUrl(ContentResolver resolver, Uri uri, long mediaId, boolean isVideo, int maxDim, int quality) {
        Bitmap bmp = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bmp = resolver.loadThumbnail(uri, new Size(maxDim, maxDim), null);
            } else if (isVideo) {
                bmp = MediaStore.Video.Thumbnails.getThumbnail(resolver, mediaId, MediaStore.Video.Thumbnails.MINI_KIND, null);
            } else {
                bmp = MediaStore.Images.Thumbnails.getThumbnail(resolver, mediaId, MediaStore.Images.Thumbnails.MINI_KIND, null);
            }
            if (bmp == null) return "";
            ByteArrayOutputStream baos = new ByteArrayOutputStream(24576);
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos);
            return "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (Throwable ignored) {
            return "";
        } finally {
            if (bmp != null && !bmp.isRecycled()) {
                try {
                    bmp.recycle();
                } catch (Throwable ignored) {
                }
            }
        }
    }

    private Long extractNumericMediaStoreIdFromFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) return null;
        if (fileName.startsWith("ms_img_")) {
            try {
                return Long.parseLong(fileName.substring(7));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        int dot = fileName.lastIndexOf('.');
        String stem = (dot > 0) ? fileName.substring(0, dot) : fileName;
        // Android PhotoPicker 파일명 패턴: "1000008588.jpg" 또는 "msf:1000008588"
        if (stem.startsWith("msf:")) {
            stem = stem.substring(4);
        }
        if (stem.matches("^\\d{4,18}$")) {
            try {
                return Long.parseLong(stem);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Long queryMediaStoreIdForPhoto(ContentResolver resolver, String fileName, long fileSize, boolean includeTrashed) {
        try {
            String[] projection = new String[] {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.SIZE
            };
            Bundle queryArgs = new Bundle();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && includeTrashed) {
                queryArgs.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE);
            }
            if (fileName != null && !fileName.isEmpty()) {
                queryArgs.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, MediaStore.Images.Media.DISPLAY_NAME + " = ?");
                queryArgs.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, new String[] { fileName });
                try (Cursor c = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, queryArgs, null)) {
                    if (c != null && c.moveToFirst()) {
                        return c.getLong(0);
                    }
                }
            }
            if (fileSize > 0) {
                Bundle sizeArgs = new Bundle();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && includeTrashed) {
                    sizeArgs.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE);
                }
                sizeArgs.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, MediaStore.Images.Media.SIZE + " = ?");
                sizeArgs.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, new String[] { String.valueOf(fileSize) });
                try (Cursor c = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, sizeArgs, null)) {
                    if (c != null && c.moveToFirst()) {
                        return c.getLong(0);
                    }
                }
            }
        } catch (Throwable ignored) {
        }
        return null;
    }

    @PluginMethod
    public void consumePendingDeepLink(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            JSObject empty = new JSObject();
            empty.put("ok", false);
            empty.put("deepLinkUrl", "");
            call.resolve(empty);
            return;
        }
        android.content.SharedPreferences prefs = ctx.getSharedPreferences("ghosti_deep_links", Context.MODE_PRIVATE);
        String pendingUrl = prefs.getString("pending_deep_link_url", "");
        if (pendingUrl != null && !pendingUrl.trim().isEmpty()) {
            prefs.edit().remove("pending_deep_link_url").apply();
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("deepLinkUrl", pendingUrl);
            ret.put("source", "intent");
            call.resolve(ret);
            return;
        }

        boolean referrerChecked = prefs.getBoolean("install_referrer_checked", false);
        if (referrerChecked) {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("deepLinkUrl", "");
            ret.put("source", "none");
            call.resolve(ret);
            return;
        }

        try {
            final InstallReferrerClient referrerClient = InstallReferrerClient.newBuilder(ctx).build();
            referrerClient.startConnection(new InstallReferrerStateListener() {
                private boolean resolved = false;

                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    if (resolved) return;
                    resolved = true;
                    String resolvedInviteUrl = "";
                    try {
                        prefs.edit().putBoolean("install_referrer_checked", true).apply();
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            ReferrerDetails details = referrerClient.getInstallReferrer();
                            String rawRef = details != null ? details.getInstallReferrer() : "";
                            if (rawRef != null && rawRef.contains("invite=")) {
                                resolvedInviteUrl = "ghosti://invite?" + rawRef;
                            }
                        }
                    } catch (Throwable ignored) {
                    } finally {
                        try {
                            referrerClient.endConnection();
                        } catch (Throwable ignored) {
                        }
                    }
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    ret.put("deepLinkUrl", resolvedInviteUrl);
                    ret.put("source", resolvedInviteUrl.isEmpty() ? "none" : "install_referrer");
                    call.resolve(ret);
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    if (resolved) return;
                    resolved = true;
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    ret.put("deepLinkUrl", "");
                    ret.put("source", "disconnected");
                    call.resolve(ret);
                }
            });
        } catch (Throwable t) {
            prefs.edit().putBoolean("install_referrer_checked", true).apply();
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("deepLinkUrl", "");
            ret.put("source", "error");
            call.resolve(ret);
        }
    }
}
