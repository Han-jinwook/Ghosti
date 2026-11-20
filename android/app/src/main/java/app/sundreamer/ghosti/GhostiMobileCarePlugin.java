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
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.media.ExifInterface;
import android.media.Image;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.net.Uri;
import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLExt;
import android.opengl.EGLSurface;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Size;
import android.view.Surface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

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
            alias = "mediaSelected",
            strings = {
                Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
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
        // 1순위: CleanX (TapSuite / XStudios / Otto / CleanX MAX / 클린엑스) 및 실존 변종 주간구독 유도 클리너 패밀리
        "com.xstudios.cleanx",
        "com.xstudios.fastscan",
        "com.tapsuite.cleanx",
        "com.otto.clean",
        "com.cleanx.app",
        "com.cleanxmax",
        "com.storage.androidcleaner.phonecleaner",
        "com.fc.ai.storage.clean.storageclean.optimize",
        "com.innovatedevx.cleanax.phone.storage.cleaner",
        "com.baloota.xcleaner",
        "com.ndsoftware.xcleaner",
        "com.cleanlyx.cleaner",
        "com.nirvanayazilim.cleanpex",
        "com.heartsnet.tidyx.gp",
        "com.cleanx.storage.cleaner",
        "com.cleanx.phone.cleaner",
        "com.storage.cleaner.cleanx",
        "com.smart.cleaner.cleanx",

        // 2순위: 주간/월간 고액 자동결제 유도(Fleeceware) 및 광고폭탄 폰 클리너·부스터 대표 패키지
        "com.cleanerguru.app",
        "com.cleaner.guru.storage.clean",
        "com.ai.photo.cleaner",
        "com.ai.phone.cleaner",
        "com.ai.photo.cleaner.swipe",
        "com.ai.cleaner.storage.master",
        "com.aicleaner.phone.storagecleanup",
        "com.aicleaner.clean.cleanstorage.ai",
        "com.aicleaner.cleanstorage.cleanduplicate.app",
        "com.clean.ai.cleanduplicated.cleanstorage",
        "com.cleaner.phone.junk.files",
        "com.phone.cleaner.clean.junk.storage.cache",
        "com.phone.cleaner.junkfiles.cleanduplicated.storagecleaner",
        "com.phonecleaner.storagecleaner.junkcleaner.cleanphone",
        "com.phonecleaner.junkcleaner.virusscan.antivirus.viruscleaner",
        "com.phonecleaner.aicleaner.storage.swipephoto",
        "com.phonecleaner.smartclean.storagecleaner.app",
        "com.storage.androidcleaner",
        "com.storage.androidcleaner.junkfiles.storagecleaner",
        "com.storage.android.cleaner",
        "com.storage.clean.nietsnie",
        "com.storage.cleaner.markcon",
        "cleaner.clean.booster",
        "cleaner.cleanup.phone.clean.storage",
        "cleaner.clean.master.clear.phone.lite",
        "antivirus.virus.cleaner.clean.vpn.booster",
        "biz.cloudex.android.cleaner",
        "co.appnation.phonecleaner",
        "com.anysoft.zerocleaner",
        "com.express.phone.cleaner",
        "com.fluxclean.ai",
        "com.hyperclean.ai",
        "com.freespace.cleanup",
        "com.neo.cleaner.storage.ai",
        "com.cleanmaster.phonejunkcleaner",
        "com.pixsterstudio.cleaner",
        "com.spaceup.cleaner",
        "com.apperslab.spacecleaner",
        "com.coreclean.storage.ram.booster",
        "com.totalcleaner.android",
        "ai.junk.cleaner",
        "ai.storage.cleaner.app",
        "app.quiet.cleanmanager",
        "app.quiet.storagecleaner",
        "com.canopas.cleanai",
        "com.cleanerapp.storagecleaner.duplicate.remover.spacecleaner.naut",
        "com.cleanspace.storage.cleaner.duplicatecleaner.filecleaner.saf",
        "com.cleansweep.storage_cleaner",
        "com.es.all.cleaner",
        "com.levelpulse.phonedeepcleaner",
        "com.rvappstudios.phone.storage.cleaner.disk.space.cleanup.duplicate.remover",
        "com.sc.phonecleaner.storagecleaner",
        "com.stormygrowth.cleangenie",
        "com.tidyspace.app",
        "com.ushareit.cleanit",
        "com.utilityhub.aicleaner",
        "ee.simplesoft.junkcleaner",
        "myfiles.filemanager.fileexplorer.cleaner",
        "storage.phone.cleaner.smart",
        "com.baxolino.bcleaner",
        "com.mna.cleaner.junk.phonecleaner.app",
        "com.xtraszone.smartclean",
        "easy.cleaner.app",
        "phone.clean.master.battery.antivirus.ora",
        "phonecleaner.junkfiles.appmanager.duplicatefileremover.applock",
        "smart.cleaner.clean.master.booster.free",
        "smarttool.phonecleaner.phoneoptimizer",
        "com.bulkar.safecleaning",
        "com.cleanerwl04.app",
        "com.luminousbyte.cleaner.storage.ai",
        "com.pivotmasterapps.phonecleaner",
        "com.procleaner.photovideoduplicatecleaner",
        "com.smartclean.storage.junk.aicleaner",
        "com.tranvision.ai.cleaner",
        "com.wapspin.SmartCleaner",
        "phone.cleaner.storage.mh",
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
        "com.swipe.photo.cleaner",
        "com.cleanup.phone.storage.cleaner",
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

    private static final String[] SAFE_ALLOWLIST_PREFIXES = new String[] {
        "app.sundreamer.",
        "com.android.",
        "com.google.android.",
        "com.sec.android.",
        "com.samsung.",
        "com.ahnlab.",
        "com.estsoft.",
        "com.kakao.",
        "com.nhn.",
        "com.naver.",
        "com.microsoft.",
        "com.adobe.",
        "com.canva."
    };

    private static final String[] STORAGE_CLEANER_INTENT_ACTIONS = new String[] {
        "android.os.storage.action.CLEAR_APP_CACHE",
        "android.os.storage.action.MANAGE_STORAGE",
        "android.intent.action.MANAGE_PACKAGE_STORAGE"
    };

    private boolean isSafeAllowlistedPackage(String pkg) {
        if (pkg == null || pkg.isEmpty()) return true;
        for (String prefix : SAFE_ALLOWLIST_PREFIXES) {
            if (pkg.startsWith(prefix)) return true;
        }
        return false;
    }

    private boolean isSuspiciousCleanerKeyword(String pkgOrLabel) {
        if (pkgOrLabel == null) return false;
        String low = pkgOrLabel.toLowerCase(Locale.ROOT);
        return low.contains("cleanx")
            || low.contains("clean x")
            || low.contains("클린x")
            || low.contains("클린엑스")
            || low.contains("cleaner")
            || low.contains("storageclean")
            || low.contains("phoneclean")
            || low.contains("junk")
            || low.contains("booster")
            || low.contains("cooler")
            || low.contains("optimizer")
            || low.contains("클리너")
            || low.contains("폰청소")
            || low.contains("부스터");
    }

    private void collectSuspiciousResolvedPackages(PackageManager pm, Intent queryIntent, Set<String> candidatePackages) {
        try {
            List<ResolveInfo> resolved = pm.queryIntentActivities(queryIntent, 0);
            if (resolved == null) return;
            for (ResolveInfo ri : resolved) {
                if (ri.activityInfo == null || ri.activityInfo.packageName == null) continue;
                String foundPkg = ri.activityInfo.packageName;
                ApplicationInfo ai = ri.activityInfo.applicationInfo;
                boolean isSystemApp = ai != null && ((ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                    || (ai.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0);
                if (isSystemApp || isSafeAllowlistedPackage(foundPkg)) {
                    continue;
                }
                String label = ai != null ? String.valueOf(pm.getApplicationLabel(ai)) : foundPkg;
                if (isSuspiciousCleanerKeyword(foundPkg) || isSuspiciousCleanerKeyword(label)) {
                    candidatePackages.add(foundPkg);
                }
            }
        } catch (Throwable ignored) {
        }
    }

    @PluginMethod
    public void scanInstalledBloatCleaners(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            JSObject emptyRet = new JSObject();
            emptyRet.put("ok", false);
            emptyRet.put("scannedCount", TARGET_BLOAT_PACKAGES.length);
            emptyRet.put("detected", new JSArray());
            call.resolve(emptyRet);
            return;
        }
        PackageManager pm = context.getPackageManager();
        Set<String> candidatePackages = new LinkedHashSet<>(Arrays.asList(TARGET_BLOAT_PACKAGES));
        Map<String, String> customRiskByPkg = new HashMap<>();

        // 1) 웹 원격 DB(public/mobile_bloat_cleaners_db.json)에서 실시간 전달된 신종 패키지 병합
        try {
            JSArray extraPackages = call.getArray("extraPackages");
            if (extraPackages != null) {
                for (int i = 0; i < extraPackages.length(); i++) {
                    String extraPkg = extraPackages.optString(i, "").trim();
                    if (!extraPkg.isEmpty() && !isSafeAllowlistedPackage(extraPkg)) {
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
        } catch (Throwable ignored) {
        }

        // 2) <queries>의 합법 <intent> 시그니처를 통해 노출된 신종 서드파티 클리너 패키지 자동 포착
        for (String action : STORAGE_CLEANER_INTENT_ACTIONS) {
            collectSuspiciousResolvedPackages(pm, new Intent(action), candidatePackages);
        }
        Intent shareImgIntent = new Intent(Intent.ACTION_SEND);
        shareImgIntent.setType("image/*");
        collectSuspiciousResolvedPackages(pm, shareImgIntent, candidatePackages);

        JSArray detected = new JSArray();
        for (String pkg : candidatePackages) {
            if (isSafeAllowlistedPackage(pkg)) continue;
            try {
                PackageInfo info = pm.getPackageInfo(pkg, 0);
                if (info != null) {
                    ApplicationInfo appInfo = info.applicationInfo;
                    boolean isSystemApp = appInfo != null && ((appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                        || (appInfo.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0);
                    if (isSystemApp) continue;

                    String appLabel = appInfo != null ? String.valueOf(pm.getApplicationLabel(appInfo)) : pkg;
                    String combinedLower = (pkg + " " + appLabel).toLowerCase(Locale.ROOT);
                    boolean isCleanX = combinedLower.contains("cleanx")
                        || combinedLower.contains("clean x")
                        || combinedLower.contains("클린x")
                        || combinedLower.contains("클린엑스");
                    boolean isSubTrap = isCleanX
                        || combinedLower.contains("guru")
                        || combinedLower.contains("swipe")
                        || combinedLower.contains("ai.cleaner")
                        || combinedLower.contains("aicleaner");
                    String customRisk = customRiskByPkg.get(pkg);
                    String riskSummary = (customRisk != null && !customRisk.isEmpty())
                        ? customRisk
                        : isCleanX
                        ? "🚨 [구독함정·권한침투] 무료체험 후 주 13,000원(월 52,000원) 자동결제 유도 및 Google 계정 데이터 접근 권한 위험"
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
            } catch (Throwable ignored) {
            }
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("scannedCount", candidatePackages.size());
        ret.put("detected", detected);
        call.resolve(ret);
    }

    private void launchExternalIntentSafely(Intent primary, Intent fallback, PluginCall call, JSObject successPayload, String errPrefix) {
        Activity act = getActivity();
        Context ctx = act != null ? act : getContext();
        if (ctx == null) {
            call.reject(errPrefix + ": NO_CONTEXT");
            return;
        }
        Runnable task = () -> {
            try {
                if (!(ctx instanceof Activity)) {
                    primary.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                }
                ctx.startActivity(primary);
                call.resolve(successPayload);
            } catch (Throwable e) {
                if (fallback != null) {
                    try {
                        if (!(ctx instanceof Activity)) {
                            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        }
                        ctx.startActivity(fallback);
                        call.resolve(successPayload);
                        return;
                    } catch (Throwable ex) {
                        call.reject(errPrefix + ": " + ex.getMessage());
                        return;
                    }
                }
                call.reject(errPrefix + ": " + e.getMessage());
            }
        };
        if (act != null) {
            act.runOnUiThread(task);
        } else {
            task.run();
        }
    }

    @PluginMethod
    public void openAppUninstallScreen(PluginCall call) {
        String pkg = call.getString("packageName", "");
        Context context = getContext();
        if (context == null || pkg == null || pkg.trim().isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("installed", false);
            ret.put("packageName", pkg != null ? pkg : "");
            ret.put("mode", "empty_package");
            call.resolve(ret);
            return;
        }
        String cleanPkg = pkg.trim();
        boolean installed = false;
        try {
            installed = (context.getPackageManager().getPackageInfo(cleanPkg, 0) != null);
        } catch (Throwable ignored) {
            installed = false;
        }
        // 미설치 패키지에 대해 ACTION_APPLICATION_DETAILS_SETTINGS를 호출하면 일부 삼성 One UI에서 설정 앱 오류 팝업이 뜨므로 사전 차단
        if (!installed) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("installed", false);
            ret.put("packageName", cleanPkg);
            ret.put("mode", "not_installed");
            call.resolve(ret);
            return;
        }

        Intent detailsIntent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + cleanPkg)
        );
        Intent delIntent = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + cleanPkg));
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("installed", true);
        ret.put("packageName", cleanPkg);
        ret.put("mode", "app_details");
        launchExternalIntentSafely(detailsIntent, delIntent, call, ret, "UNINSTALL_SCREEN_FAILED");
    }

    @PluginMethod
    public void openPlayStoreSubscriptions(PluginCall call) {
        String pkg = call.getString("packageName", "");
        String url = (pkg != null && !pkg.trim().isEmpty())
            ? "https://play.google.com/store/account/subscriptions?package=" + Uri.encode(pkg.trim())
            : "https://play.google.com/store/account/subscriptions";
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("url", url);
        launchExternalIntentSafely(intent, null, call, ret, "OPEN_SUBSCRIPTIONS_FAILED");
    }

    @PluginMethod
    public void openGoogleAccountPermissions(PluginCall call) {
        String url = "https://myaccount.google.com/permissions";
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("url", url);
        launchExternalIntentSafely(intent, null, call, ret, "OPEN_GOOGLE_PERMISSIONS_FAILED");
    }

    @PluginMethod
    public void openAllInstalledAppsSettings(PluginCall call) {
        Intent primary = new Intent(Settings.ACTION_MANAGE_ALL_APPLICATIONS_SETTINGS);
        Intent fallback = new Intent(Settings.ACTION_APPLICATION_SETTINGS);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        launchExternalIntentSafely(primary, fallback, call, ret, "OPEN_ALL_APPS_FAILED");
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

    private boolean hasImageReadPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
                || ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
        }
        return ctx.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasVideoReadPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
                || ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED;
        }
        return ctx.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasFullPhotoAndVideoPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
                && ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED;
        }
        return ctx.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isLimitedVisualPermissionOnly(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return !hasFullPhotoAndVideoPermission(ctx)
                && ctx.checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED;
        }
        return false;
    }

    private boolean hasMediaReadPermission(Context ctx) {
        return hasImageReadPermission(ctx) || hasVideoReadPermission(ctx);
    }

    private void requestGalleryPermissionsUnified(PluginCall call, String callbackName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            requestPermissionForAliases(new String[] { "mediaModern", "mediaSelected" }, call, callbackName);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("mediaModern", call, callbackName);
        } else {
            requestPermissionForAlias("mediaLegacy", call, callbackName);
        }
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
        boolean forceExpandSelected = call.getBoolean("forceExpandSelected", false);
        int offset = Math.max(0, call.getInt("offset", 0));
        boolean includeVideos = call.getBoolean("includeVideos", offset == 0);

        boolean anyPerm = hasMediaReadPermission(ctx);
        boolean missingVideoUpgradePerm = includeVideos && !hasVideoReadPermission(ctx);

        if ((!anyPerm || missingVideoUpgradePerm || forceExpandSelected) && promptPerm) {
            requestGalleryPermissionsUnified(call, "onMediaPermissionForGalleryScan");
            return;
        }
        if (!anyPerm) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("permissionGranted", false);
            ret.put("limitedAccess", false);
            ret.put("videoPermissionGranted", false);
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
            ret.put("limitedAccess", false);
            ret.put("videoPermissionGranted", false);
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
        final int limit = Math.min(100, Math.max(1, call.getInt("limit", 60)));
        final int thumbMaxDim = Math.min(640, Math.max(240, call.getInt("thumbMaxDim", 512)));
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
                        try {
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
                            String thumbDataUrl = encodeThumbnailDataUrl(resolver, imgUri, id, false, thumbMaxDim, 82);
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
                        } catch (Throwable ignored) {
                        }
                    }
                } finally {
                    if (imgCursor != null) imgCursor.close();
                }
            } catch (Throwable ignored) {
            }

            // 3) 첫 페이지(offset == 0) 호출 시 최근 동영상 최대 40개 독립 안전 조회
            if (includeVideos && hasVideoReadPermission(appCtx)) {
                try {
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
                            vArgs.putInt(ContentResolver.QUERY_ARG_LIMIT, 40);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                vArgs.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_EXCLUDE);
                            }
                            vidCursor = resolver.query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, vidProj, vArgs, null);
                        } else {
                            vidCursor = resolver.query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, vidProj, null, null, MediaStore.Video.Media.DATE_MODIFIED + " DESC");
                        }
                        int vCount = 0;
                        while (vidCursor != null && vidCursor.moveToNext() && vCount < 40) {
                            vCount++;
                            try {
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
                            } catch (Throwable ignored) {
                            }
                        }
                    } finally {
                        if (vidCursor != null) vidCursor.close();
                    }
                } catch (Throwable ignored) {
                }
            }

            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("permissionGranted", true);
            ret.put("limitedAccess", isLimitedVisualPermissionOnly(appCtx));
            ret.put("videoPermissionGranted", hasVideoReadPermission(appCtx));
            ret.put("offset", offset);
            ret.put("totalPhotoCount", totalPhotoCount);
            ret.put("photos", photosArr);
            ret.put("videos", videosArr);
            call.resolve(ret);
        }, "GhostiGalleryScanner").start();
    }

    /**
     * [근본 원인 해결: MediaStore.loadThumbnail의 EXIF 320x240 저해상도 썸네일 업스케일링 함정 원천 차단]
     * - Android MediaProvider의 loadThumbnail()은 카메라 사진 헤더 내 320x240 EXIF 내장 썸네일을 꺼낸 뒤 448~512px로 바이리니어 확대(Upscale)하여
     *   선명한 정상 사진까지 라플라시안 고주파 경계가 붕괴(hfRatio 1.5 -> 0.72)되는 오분류를 유발합니다.
     * - 따라서 정지 사진(!isVideo)은 ImageDecoder(API 28+) / BitmapFactory(inSampleSize)로 원본 이미지 스트림에서 직접 정밀 축소 디코딩하며,
     *   절대 작은 EXIF 썸네일을 확대하지 않습니다.
     */
    private Bitmap decodeCrispPhotoStreamBitmap(ContentResolver resolver, Uri uri, final int maxDim) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                ImageDecoder.Source src = ImageDecoder.createSource(resolver, uri);
                return ImageDecoder.decodeBitmap(src, (decoder, info, source) -> {
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                    Size sz = info.getSize();
                    int w = sz.getWidth();
                    int h = sz.getHeight();
                    int longest = Math.max(w, h);
                    if (w > 0 && h > 0 && longest > maxDim) {
                        float scale = (float) maxDim / (float) longest;
                        decoder.setTargetSize(
                            Math.max(1, Math.round(w * scale)),
                            Math.max(1, Math.round(h * scale))
                        );
                    }
                });
            } catch (Throwable ignored) {
                // Fallback below
            }
        }

        try {
            BitmapFactory.Options boundsOpts = new BitmapFactory.Options();
            boundsOpts.inJustDecodeBounds = true;
            try (InputStream is = resolver.openInputStream(uri)) {
                if (is == null) return null;
                BitmapFactory.decodeStream(is, null, boundsOpts);
            }
            int outW = boundsOpts.outWidth;
            int outH = boundsOpts.outHeight;
            if (outW <= 0 || outH <= 0) return null;

            int inSampleSize = 1;
            while ((Math.max(outW, outH) / (inSampleSize * 2)) >= maxDim) {
                inSampleSize *= 2;
            }

            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
            decodeOpts.inSampleSize = inSampleSize;
            decodeOpts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            Bitmap decoded;
            try (InputStream is2 = resolver.openInputStream(uri)) {
                if (is2 == null) return null;
                decoded = BitmapFactory.decodeStream(is2, null, decodeOpts);
            }
            if (decoded == null) return null;

            int deg = 0;
            try (InputStream exifStream = resolver.openInputStream(uri)) {
                if (exifStream != null) {
                    ExifInterface exif = new ExifInterface(exifStream);
                    int ori = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                    if (ori == ExifInterface.ORIENTATION_ROTATE_90) deg = 90;
                    else if (ori == ExifInterface.ORIENTATION_ROTATE_180) deg = 180;
                    else if (ori == ExifInterface.ORIENTATION_ROTATE_270) deg = 270;
                }
            } catch (Throwable ignored) {
            }

            int dw = decoded.getWidth();
            int dh = decoded.getHeight();
            int longest = Math.max(dw, dh);
            float scale = longest > maxDim ? ((float) maxDim / (float) longest) : 1.0f;
            if (deg != 0 || scale < 0.999f) {
                Matrix m = new Matrix();
                if (scale < 0.999f) {
                    m.postScale(scale, scale);
                }
                if (deg != 0) {
                    m.postRotate(deg);
                }
                Bitmap transformed = Bitmap.createBitmap(decoded, 0, 0, dw, dh, m, true);
                if (transformed != decoded) {
                    decoded.recycle();
                }
                return transformed;
            }
            return decoded;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private String encodeThumbnailDataUrl(ContentResolver resolver, Uri uri, long mediaId, boolean isVideo, int maxDim, int quality) {
        Bitmap bmp = null;
        try {
            if (!isVideo) {
                bmp = decodeCrispPhotoStreamBitmap(resolver, uri, maxDim);
            }
            if (bmp == null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    bmp = resolver.loadThumbnail(uri, new Size(maxDim, maxDim), null);
                } else if (isVideo) {
                    bmp = MediaStore.Video.Thumbnails.getThumbnail(resolver, mediaId, MediaStore.Video.Thumbnails.MINI_KIND, null);
                } else {
                    bmp = MediaStore.Images.Thumbnails.getThumbnail(resolver, mediaId, MediaStore.Images.Thumbnails.MINI_KIND, null);
                }
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

    private static final Object H264_TRANSCODE_LOCK = new Object();

    private static void writeBitmapToYuv420Image(int[] argb, int width, int height, Image image) {
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer yBuf = planes[0].getBuffer();
        ByteBuffer uBuf = planes[1].getBuffer();
        ByteBuffer vBuf = planes[2].getBuffer();
        int yRowStride = planes[0].getRowStride();
        int yPixelStride = planes[0].getPixelStride();
        int uRowStride = planes[1].getRowStride();
        int uPixelStride = planes[1].getPixelStride();
        int vRowStride = planes[2].getRowStride();
        int vPixelStride = planes[2].getPixelStride();
        int yCap = yBuf.capacity();
        int uCap = uBuf.capacity();
        int vCap = vBuf.capacity();

        for (int j = 0; j < height; j++) {
            int rowOff = j * width;
            int yLine = j * yRowStride;
            int uvLineU = (j >> 1) * uRowStride;
            int uvLineV = (j >> 1) * vRowStride;
            boolean evenRow = (j & 1) == 0;
            for (int i = 0; i < width; i++) {
                int c = argb[rowOff + i];
                int r = (c >> 16) & 0xff;
                int g = (c >> 8) & 0xff;
                int b = c & 0xff;
                int y = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                int yPos = yLine + i * yPixelStride;
                if (yPos >= 0 && yPos < yCap) {
                    yBuf.put(yPos, (byte) Math.max(0, Math.min(255, y)));
                }
                if (evenRow && (i & 1) == 0) {
                    int u = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                    int v = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                    int uvIdx = i >> 1;
                    int uPos = uvLineU + uvIdx * uPixelStride;
                    int vPos = uvLineV + uvIdx * vPixelStride;
                    if (uPos >= 0 && uPos < uCap) {
                        uBuf.put(uPos, (byte) Math.max(0, Math.min(255, u)));
                    }
                    if (vPos >= 0 && vPos < vCap) {
                        vBuf.put(vPos, (byte) Math.max(0, Math.min(255, v)));
                    }
                }
            }
        }
    }

    private boolean needsH264Transcode(Context appCtx, Uri videoUri) {
        MediaExtractor ex = new MediaExtractor();
        try {
            ex.setDataSource(appCtx, videoUri, (Map<String, String>) null);
            int tracks = ex.getTrackCount();
            boolean foundAvc = false;
            for (int i = 0; i < tracks; i++) {
                MediaFormat fmt = ex.getTrackFormat(i);
                String mime = fmt.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/")) {
                    if (!MediaFormat.MIMETYPE_VIDEO_AVC.equalsIgnoreCase(mime)) {
                        return true;
                    }
                    foundAvc = true;
                    if (fmt.containsKey(MediaFormat.KEY_PROFILE)) {
                        int profile = fmt.getInteger(MediaFormat.KEY_PROFILE);
                        // 10-bit / 4:2:2 / 4:4:4 AVC profiles unsupported by mobile WebView <video>
                        if (profile == MediaCodecInfo.CodecProfileLevel.AVCProfileHigh10
                            || profile == MediaCodecInfo.CodecProfileLevel.AVCProfileHigh422
                            || profile == MediaCodecInfo.CodecProfileLevel.AVCProfileHigh444) {
                            return true;
                        }
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && fmt.containsKey(MediaFormat.KEY_COLOR_TRANSFER)) {
                        int ct = fmt.getInteger(MediaFormat.KEY_COLOR_TRANSFER);
                        // ST2084 (HDR10 / HDR10+) or HLG 10-bit
                        if (ct == MediaFormat.COLOR_TRANSFER_ST2084 || ct == MediaFormat.COLOR_TRANSFER_HLG) {
                            return true;
                        }
                    }
                }
            }
            return !foundAvc;
        } catch (Throwable ignored) {
            return false;
        } finally {
            try {
                ex.release();
            } catch (Throwable ignored) {
            }
        }
    }

    private MediaCodec createCompatibleAvcEncoder() throws java.io.IOException {
        String[] preferredSwCodecs = new String[] {
            "c2.android.avc.encoder",
            "OMX.google.h264.encoder"
        };
        for (String name : preferredSwCodecs) {
            try {
                return MediaCodec.createByCodecName(name);
            } catch (Throwable ignored) {
            }
        }
        return MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
    }

    private static void writeBitmapToNv12ByteBuffer(int[] argb, int width, int height, ByteBuffer buf) {
        buf.clear();
        int cap = buf.capacity();
        int ySize = width * height;
        for (int j = 0; j < height; j++) {
            int rowOff = j * width;
            boolean evenRow = (j & 1) == 0;
            int uvRowOff = ySize + (j >> 1) * width;
            for (int i = 0; i < width; i++) {
                int c = argb[rowOff + i];
                int r = (c >> 16) & 0xff;
                int g = (c >> 8) & 0xff;
                int b = c & 0xff;
                int y = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                int yIdx = rowOff + i;
                if (yIdx < cap) {
                    buf.put(yIdx, (byte) Math.max(0, Math.min(255, y)));
                }
                if (evenRow && (i & 1) == 0) {
                    int u = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                    int v = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                    int uvIdx = uvRowOff + i;
                    if (uvIdx + 1 < cap) {
                        buf.put(uvIdx, (byte) Math.max(0, Math.min(255, u)));
                        buf.put(uvIdx + 1, (byte) Math.max(0, Math.min(255, v)));
                    }
                }
            }
        }
    }

    private static int compileGlShader(int shaderType, String source) {
        int shader = GLES20.glCreateShader(shaderType);
        GLES20.glShaderSource(shader, source);
        GLES20.glCompileShader(shader);
        int[] compiled = new int[1];
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0);
        if (compiled[0] == 0) {
            GLES20.glDeleteShader(shader);
            return 0;
        }
        return shader;
    }

    private File ensurePlayableH264Mp4(Context appCtx, long mediaId) {
        synchronized (H264_TRANSCODE_LOCK) {
            File cacheRoot = new File(appCtx.getCacheDir(), "ghosti_vid_stream");
            if (!cacheRoot.exists()) {
                cacheRoot.mkdirs();
            }
            File outFile = new File(cacheRoot, "vid_h264_v3_" + mediaId + ".mp4");
            if (outFile.exists() && outFile.length() > 4096L) {
                outFile.setLastModified(System.currentTimeMillis());
                return outFile;
            }
            File tmpFile = new File(cacheRoot, "vid_h264_v3_" + mediaId + "_" + System.nanoTime() + ".tmp");
            Uri videoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, mediaId);

            // [100% 하드웨어 GPU Surface-to-Surface 고속 트랜스코딩 (0.4~1.1초 완결 · MediaMetadataRetriever 멈춤 근절)]:
            // MediaExtractor -> Hardware MediaCodec Decoder (SurfaceTexture + EGL14 OES) -> Hardware AVC Encoder (COLOR_FormatSurface) + MediaMuxer
            MediaExtractor videoEx = null;
            MediaExtractor audioEx = null;
            MediaCodec decoder = null;
            MediaCodec encoder = null;
            MediaMuxer muxer = null;
            boolean muxerStarted = false;

            EGLDisplay eglDisplay = EGL14.EGL_NO_DISPLAY;
            EGLContext eglContext = EGL14.EGL_NO_CONTEXT;
            EGLSurface eglSurface = EGL14.EGL_NO_SURFACE;
            Surface encoderInputSurface = null;
            Surface decoderOutputSurface = null;
            SurfaceTexture surfaceTexture = null;
            HandlerThread oesCbThread = null;
            int glProgram = 0;
            int oesTexId = 0;

            try {
                videoEx = new MediaExtractor();
                videoEx.setDataSource(appCtx, videoUri, (Map<String, String>) null);
                int srcVideoTrack = -1;
                MediaFormat srcVideoFmt = null;
                int srcAudioTrack = -1;
                MediaFormat srcAudioFmt = null;

                for (int ti = 0; ti < videoEx.getTrackCount(); ti++) {
                    MediaFormat tf = videoEx.getTrackFormat(ti);
                    String tm = tf.getString(MediaFormat.KEY_MIME);
                    if (tm == null) continue;
                    if (srcVideoTrack < 0 && tm.startsWith("video/")) {
                        srcVideoTrack = ti;
                        srcVideoFmt = tf;
                    } else if (srcAudioTrack < 0 && tm.startsWith("audio/mp4a")) {
                        srcAudioTrack = ti;
                        srcAudioFmt = tf;
                    }
                }
                if (srcVideoTrack < 0 || srcVideoFmt == null) {
                    return null;
                }

                String srcMime = srcVideoFmt.getString(MediaFormat.KEY_MIME);
                int rawW = srcVideoFmt.containsKey(MediaFormat.KEY_WIDTH) ? srcVideoFmt.getInteger(MediaFormat.KEY_WIDTH) : 1280;
                int rawH = srcVideoFmt.containsKey(MediaFormat.KEY_HEIGHT) ? srcVideoFmt.getInteger(MediaFormat.KEY_HEIGHT) : 720;
                int rotDeg = 0;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && srcVideoFmt.containsKey(MediaFormat.KEY_ROTATION)) {
                    rotDeg = srcVideoFmt.getInteger(MediaFormat.KEY_ROTATION);
                } else {
                    MediaMetadataRetriever rotRet = new MediaMetadataRetriever();
                    try {
                        rotRet.setDataSource(appCtx, videoUri);
                        String rStr = rotRet.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
                        if (rStr != null && !rStr.trim().isEmpty()) {
                            rotDeg = Integer.parseInt(rStr.trim());
                        }
                    } catch (Throwable ignored) {
                    } finally {
                        try { rotRet.release(); } catch (Throwable ignored) {}
                    }
                }
                rotDeg = ((rotDeg % 360) + 360) % 360;
                int dispW = (rotDeg == 90 || rotDeg == 270) ? rawH : rawW;
                int dispH = (rotDeg == 90 || rotDeg == 270) ? rawW : rawH;
                float scale = Math.min(1.0f, 960.0f / (float) Math.max(dispW, dispH));
                int outW = Math.max(160, (Math.round(dispW * scale) / 16) * 16);
                int outH = Math.max(160, (Math.round(dispH * scale) / 16) * 16);
                int outFps = 30;
                if (srcVideoFmt.containsKey(MediaFormat.KEY_FRAME_RATE)) {
                    try {
                        outFps = Math.max(15, Math.min(30, srcVideoFmt.getInteger(MediaFormat.KEY_FRAME_RATE)));
                    } catch (Throwable ignored) {
                    }
                }

                MediaFormat encFmt = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, outW, outH);
                encFmt.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
                encFmt.setInteger(MediaFormat.KEY_BIT_RATE, 2800000);
                encFmt.setInteger(MediaFormat.KEY_FRAME_RATE, outFps);
                encFmt.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);

                encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
                encoder.configure(encFmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
                encoderInputSurface = encoder.createInputSurface();
                encoder.start();

                eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);
                int[] eglVer = new int[2];
                EGL14.eglInitialize(eglDisplay, eglVer, 0, eglVer, 1);
                int[] attribList = new int[] {
                    EGL14.EGL_RED_SIZE, 8,
                    EGL14.EGL_GREEN_SIZE, 8,
                    EGL14.EGL_BLUE_SIZE, 8,
                    EGL14.EGL_ALPHA_SIZE, 8,
                    EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
                    0x3142, 1, // EGL_RECORDABLE_ANDROID
                    EGL14.EGL_NONE
                };
                EGLConfig[] configs = new EGLConfig[1];
                int[] numConfigs = new int[1];
                EGL14.eglChooseConfig(eglDisplay, attribList, 0, configs, 0, configs.length, numConfigs, 0);
                int[] ctxAttribs = new int[] { EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE };
                eglContext = EGL14.eglCreateContext(eglDisplay, configs[0], EGL14.EGL_NO_CONTEXT, ctxAttribs, 0);
                int[] surfAttribs = new int[] { EGL14.EGL_NONE };
                eglSurface = EGL14.eglCreateWindowSurface(eglDisplay, configs[0], encoderInputSurface, surfAttribs, 0);
                EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext);

                String vtxSrc =
                    "uniform mat4 uSTMatrix;\n" +
                    "attribute vec4 aPosition;\n" +
                    "attribute vec4 aTextureCoord;\n" +
                    "varying vec2 vTextureCoord;\n" +
                    "void main() {\n" +
                    "  gl_Position = aPosition;\n" +
                    "  vTextureCoord = (uSTMatrix * aTextureCoord).xy;\n" +
                    "}\n";
                String fragSrc =
                    "#extension GL_OES_EGL_image_external : require\n" +
                    "precision mediump float;\n" +
                    "varying vec2 vTextureCoord;\n" +
                    "uniform samplerExternalOES sTexture;\n" +
                    "void main() {\n" +
                    "  gl_FragColor = texture2D(sTexture, vTextureCoord);\n" +
                    "}\n";
                int vShader = compileGlShader(GLES20.GL_VERTEX_SHADER, vtxSrc);
                int fShader = compileGlShader(GLES20.GL_FRAGMENT_SHADER, fragSrc);
                glProgram = GLES20.glCreateProgram();
                GLES20.glAttachShader(glProgram, vShader);
                GLES20.glAttachShader(glProgram, fShader);
                GLES20.glLinkProgram(glProgram);

                int aPosLoc = GLES20.glGetAttribLocation(glProgram, "aPosition");
                int aTexLoc = GLES20.glGetAttribLocation(glProgram, "aTextureCoord");
                int uStLoc = GLES20.glGetUniformLocation(glProgram, "uSTMatrix");

                int[] texArr = new int[1];
                GLES20.glGenTextures(1, texArr, 0);
                oesTexId = texArr[0];
                GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, oesTexId);
                GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
                GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
                GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
                GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);

                final Object frameSync = new Object();
                final boolean[] frameReady = new boolean[] { false };
                oesCbThread = new HandlerThread("GhostiOesFrameCb");
                oesCbThread.start();
                Handler oesCbHandler = new Handler(oesCbThread.getLooper());
                surfaceTexture = new SurfaceTexture(oesTexId);
                surfaceTexture.setOnFrameAvailableListener(st -> {
                    synchronized (frameSync) {
                        frameReady[0] = true;
                        frameSync.notifyAll();
                    }
                }, oesCbHandler);
                decoderOutputSurface = new Surface(surfaceTexture);

                float[] quadVerts = new float[] {
                    -1.0f, -1.0f, 0.0f, 0.0f,
                     1.0f, -1.0f, 1.0f, 0.0f,
                    -1.0f,  1.0f, 0.0f, 1.0f,
                     1.0f,  1.0f, 1.0f, 1.0f
                };
                FloatBuffer quadBuf = ByteBuffer.allocateDirect(quadVerts.length * 4)
                    .order(ByteOrder.nativeOrder())
                    .asFloatBuffer();
                quadBuf.put(quadVerts).position(0);
                float[] stMatrix = new float[16];

                videoEx.selectTrack(srcVideoTrack);
                decoder = MediaCodec.createDecoderByType(srcMime);
                decoder.configure(srcVideoFmt, decoderOutputSurface, null, 0);
                decoder.start();

                muxer = new MediaMuxer(tmpFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                int muxVideoTrack = -1;
                int muxAudioTrack = -1;

                MediaCodec.BufferInfo decInfo = new MediaCodec.BufferInfo();
                MediaCodec.BufferInfo encInfo = new MediaCodec.BufferInfo();
                boolean extractorDone = false;
                boolean decoderDone = false;
                boolean encoderDone = false;
                long lastEncodedPtsUs = -1L;
                long minFrameStepUs = (outFps >= 30) ? 31000L : 62000L;
                long maxClipPtsUs = 60_000_000L;
                long deadlineMs = SystemClock.elapsedRealtime() + 12000L;

                while (!encoderDone && SystemClock.elapsedRealtime() < deadlineMs) {
                    if (!extractorDone) {
                        int decInIdx = decoder.dequeueInputBuffer(4000L);
                        if (decInIdx >= 0) {
                            ByteBuffer decInBuf = decoder.getInputBuffer(decInIdx);
                            int sampleSz = (decInBuf != null) ? videoEx.readSampleData(decInBuf, 0) : -1;
                            long samplePtsUs = (sampleSz >= 0) ? Math.max(0L, videoEx.getSampleTime()) : 0L;
                            if (sampleSz < 0 || samplePtsUs > maxClipPtsUs) {
                                decoder.queueInputBuffer(decInIdx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                                extractorDone = true;
                            } else {
                                decoder.queueInputBuffer(decInIdx, 0, sampleSz, samplePtsUs, videoEx.getSampleFlags());
                                videoEx.advance();
                            }
                        }
                    }

                    if (!decoderDone) {
                        int decOutIdx = decoder.dequeueOutputBuffer(decInfo, 4000L);
                        if (decOutIdx >= 0) {
                            boolean isEos = (decInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                            boolean shouldRender = decInfo.size > 0
                                && (lastEncodedPtsUs < 0L || (decInfo.presentationTimeUs - lastEncodedPtsUs) >= minFrameStepUs);
                            if (shouldRender) {
                                synchronized (frameSync) {
                                    frameReady[0] = false;
                                }
                            }
                            decoder.releaseOutputBuffer(decOutIdx, shouldRender);

                            if (shouldRender) {
                                boolean gotFrame = false;
                                synchronized (frameSync) {
                                    long waitEnd = SystemClock.elapsedRealtime() + 450L;
                                    while (!frameReady[0] && SystemClock.elapsedRealtime() < waitEnd) {
                                        try {
                                            frameSync.wait(60L);
                                        } catch (InterruptedException ignored) {
                                            break;
                                        }
                                    }
                                    gotFrame = frameReady[0];
                                }
                                if (gotFrame) {
                                    surfaceTexture.updateTexImage();
                                    surfaceTexture.getTransformMatrix(stMatrix);

                                    GLES20.glViewport(0, 0, outW, outH);
                                    GLES20.glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
                                    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
                                    GLES20.glUseProgram(glProgram);
                                    GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
                                    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, oesTexId);

                                    quadBuf.position(0);
                                    GLES20.glVertexAttribPointer(aPosLoc, 2, GLES20.GL_FLOAT, false, 16, quadBuf);
                                    GLES20.glEnableVertexAttribArray(aPosLoc);
                                    quadBuf.position(2);
                                    GLES20.glVertexAttribPointer(aTexLoc, 2, GLES20.GL_FLOAT, false, 16, quadBuf);
                                    GLES20.glEnableVertexAttribArray(aTexLoc);
                                    GLES20.glUniformMatrix4fv(uStLoc, 1, false, stMatrix, 0);
                                    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);

                                    long safePtsUs = Math.max(lastEncodedPtsUs + 1000L, decInfo.presentationTimeUs);
                                    lastEncodedPtsUs = safePtsUs;
                                    EGLExt.eglPresentationTimeANDROID(eglDisplay, eglSurface, safePtsUs * 1000L);
                                    EGL14.eglSwapBuffers(eglDisplay, eglSurface);
                                }
                            }

                            if (isEos) {
                                encoder.signalEndOfInputStream();
                                decoderDone = true;
                            }
                        }
                    }

                    // 준비된 모든 인코더 출력 버퍼를 루프로 즉시 배수(Drain)하여 버퍼 포화 데드락을 100% 원천 차단
                    while (!encoderDone && SystemClock.elapsedRealtime() < deadlineMs) {
                        int encOutIdx = encoder.dequeueOutputBuffer(encInfo, decoderDone ? 4000L : 0L);
                        if (encOutIdx == MediaCodec.INFO_TRY_AGAIN_LATER) {
                            break;
                        } else if (encOutIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                            if (!muxerStarted) {
                                muxVideoTrack = muxer.addTrack(encoder.getOutputFormat());
                                if (srcAudioTrack >= 0 && srcAudioFmt != null) {
                                    try {
                                        muxAudioTrack = muxer.addTrack(srcAudioFmt);
                                    } catch (Throwable ignored) {
                                        muxAudioTrack = -1;
                                    }
                                }
                                muxer.start();
                                muxerStarted = true;
                            }
                        } else if (encOutIdx >= 0) {
                            ByteBuffer encodedData = encoder.getOutputBuffer(encOutIdx);
                            if (encodedData != null
                                && (encInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0
                                && encInfo.size > 0
                                && muxerStarted) {
                                encodedData.position(encInfo.offset);
                                encodedData.limit(encInfo.offset + encInfo.size);
                                muxer.writeSampleData(muxVideoTrack, encodedData, encInfo);
                            }
                            if ((encInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                                encoderDone = true;
                            }
                            encoder.releaseOutputBuffer(encOutIdx, false);
                        }
                    }
                }

                if (muxerStarted && muxAudioTrack >= 0 && srcAudioTrack >= 0) {
                    try {
                        audioEx = new MediaExtractor();
                        audioEx.setDataSource(appCtx, videoUri, (Map<String, String>) null);
                        audioEx.selectTrack(srcAudioTrack);
                        ByteBuffer aBuf = ByteBuffer.allocate(65536);
                        MediaCodec.BufferInfo aInfo = new MediaCodec.BufferInfo();
                        long maxAudioPtsUs = Math.max(1_000_000L, lastEncodedPtsUs + 250_000L);
                        long lastAudioPtsUs = -1L;
                        while (true) {
                            int sz = audioEx.readSampleData(aBuf, 0);
                            if (sz < 0) break;
                            long sTime = audioEx.getSampleTime();
                            if (sTime > maxAudioPtsUs) break;
                            long safePtsUs = Math.max(0L, sTime);
                            if (safePtsUs <= lastAudioPtsUs) {
                                safePtsUs = lastAudioPtsUs + 1L;
                            }
                            lastAudioPtsUs = safePtsUs;
                            int exFlags = audioEx.getSampleFlags();
                            aInfo.offset = 0;
                            aInfo.size = sz;
                            aInfo.presentationTimeUs = safePtsUs;
                            aInfo.flags = (exFlags & MediaExtractor.SAMPLE_FLAG_SYNC) != 0
                                ? MediaCodec.BUFFER_FLAG_KEY_FRAME
                                : 0;
                            muxer.writeSampleData(muxAudioTrack, aBuf, aInfo);
                            audioEx.advance();
                        }
                    } catch (Throwable audioErr) {
                        android.util.Log.w("GhostiVidH264", "Audio track copy skipped: " + audioErr.getMessage());
                    }
                }

                if (muxerStarted && lastEncodedPtsUs >= 0L) {
                    muxer.stop();
                    muxerStarted = false;
                    if (tmpFile.exists() && tmpFile.length() > 4096L) {
                        if (outFile.exists()) outFile.delete();
                        if (tmpFile.renameTo(outFile)) {
                            return outFile;
                        }
                        return tmpFile;
                    }
                }
            } catch (Throwable err) {
                android.util.Log.e("GhostiVidH264", "ensurePlayableH264Mp4 surface transcode failed for mediaId=" + mediaId, err);
            } finally {
                if (videoEx != null) {
                    try { videoEx.release(); } catch (Throwable ignored) {}
                }
                if (audioEx != null) {
                    try { audioEx.release(); } catch (Throwable ignored) {}
                }
                if (decoder != null) {
                    try { decoder.stop(); } catch (Throwable ignored) {}
                    try { decoder.release(); } catch (Throwable ignored) {}
                }
                if (encoder != null) {
                    try { encoder.stop(); } catch (Throwable ignored) {}
                    try { encoder.release(); } catch (Throwable ignored) {}
                }
                if (muxer != null) {
                    if (muxerStarted) {
                        try { muxer.stop(); } catch (Throwable ignored) {}
                    }
                    try { muxer.release(); } catch (Throwable ignored) {}
                }
                if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
                    try {
                        EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT);
                        if (eglSurface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(eglDisplay, eglSurface);
                        if (eglContext != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(eglDisplay, eglContext);
                        EGL14.eglTerminate(eglDisplay);
                    } catch (Throwable ignored) {}
                }
                if (decoderOutputSurface != null) {
                    try { decoderOutputSurface.release(); } catch (Throwable ignored) {}
                }
                if (surfaceTexture != null) {
                    try { surfaceTexture.release(); } catch (Throwable ignored) {}
                }
                if (encoderInputSurface != null) {
                    try { encoderInputSurface.release(); } catch (Throwable ignored) {}
                }
                if (oesCbThread != null) {
                    try { oesCbThread.quitSafely(); } catch (Throwable ignored) {}
                }
                if (tmpFile.exists() && !tmpFile.equals(outFile)) {
                    try { tmpFile.delete(); } catch (Throwable ignored) {}
                }
            }
            return null;
        }
    }

    @PluginMethod
    public void resolveVideoPlaybackUrl(PluginCall call) {
        Context ctx = getContext();
        String rawId = call.getString("id", "");
        final boolean forceTranscode = call.getBoolean("forceTranscode", false);
        final String digits = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (digits.isEmpty() || ctx == null) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("fileUrl", "");
            call.resolve(ret);
            return;
        }
        final Context appCtx = ctx.getApplicationContext();
        new Thread(() -> {
            JSObject ret = new JSObject();
            try {
                long mediaId = Long.parseLong(digits);
                Uri videoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, mediaId);
                boolean mustTranscode = forceTranscode || needsH264Transcode(appCtx, videoUri);
                if (!mustTranscode) {
                    ret.put("ok", true);
                    ret.put("fileUrl", "/__ghosti_media_video/" + digits + ".mp4");
                } else {
                    File h264 = ensurePlayableH264Mp4(appCtx, mediaId);
                    if (h264 != null && h264.exists() && h264.length() > 4096L) {
                        ret.put("ok", true);
                        ret.put("fileUrl", "/__ghosti_media_video/h264_" + digits + ".mp4");
                    } else if (!forceTranscode) {
                        ret.put("ok", true);
                        ret.put("fileUrl", "/__ghosti_media_video/" + digits + ".mp4");
                    } else {
                        ret.put("ok", false);
                        ret.put("fileUrl", "");
                    }
                }
            } catch (Throwable err) {
                android.util.Log.e("GhostiVidH264", "resolveVideoPlaybackUrl error", err);
                ret.put("ok", false);
                ret.put("fileUrl", "");
            }
            call.resolve(ret);
        }, "GhostiVidH264").start();
    }

    private static class VideoKeyframeCandidate {
        final int timeSec;
        final float[] lumaGrid;
        final float sharpness;
        final byte[] jpegBytes;

        VideoKeyframeCandidate(int timeSec, float[] lumaGrid, float sharpness, byte[] jpegBytes) {
            this.timeSec = timeSec;
            this.lumaGrid = lumaGrid;
            this.sharpness = sharpness;
            this.jpegBytes = jpegBytes;
        }
    }

    private static VideoKeyframeCandidate evaluateVideoFrameSharpness(Bitmap srcBmp, int timeSec) {
        int w = srcBmp.getWidth();
        int h = srcBmp.getHeight();
        if (w < 32 || h < 32) return null;

        // 1) 64x36 루마 그리드(장면 전환 MAD 클러스터링 및 암전 배제)
        int gw = 64;
        int gh = 36;
        Bitmap gridBmp = Bitmap.createScaledBitmap(srcBmp, gw, gh, true);
        int[] gPx = new int[gw * gh];
        gridBmp.getPixels(gPx, 0, gw, 0, 0, gw, gh);
        if (gridBmp != srcBmp) gridBmp.recycle();

        float[] lumaGrid = new float[gw * gh];
        double sum = 0.0;
        double sqSum = 0.0;
        for (int i = 0; i < gPx.length; i++) {
            int c = gPx[i];
            float y = ((c >> 16) & 0xff) * 0.299f + ((c >> 8) & 0xff) * 0.587f + (c & 0xff) * 0.114f;
            lumaGrid[i] = y;
            sum += y;
            sqSum += y * y;
        }
        double mean = sum / gPx.length;
        double std = Math.sqrt(Math.max(0.0, sqSum / gPx.length - mean * mean));
        if (std < 4.2) {
            return null; // 완전 암전·백색 전환 프레임 제외
        }

        // 2) 단변 240px 기준 2차 미분(Laplacian) 첨예도 측정 (PC plugin_ghosti_os.py 1:1 정합)
        int shortSide = Math.max(1, Math.min(w, h));
        float sScale = Math.min(1.0f, 240.0f / (float) shortSide);
        int sw = Math.max(32, Math.round(w * sScale));
        int sh = Math.max(32, Math.round(h * sScale));
        Bitmap lapBmp = (sw == w && sh == h) ? srcBmp : Bitmap.createScaledBitmap(srcBmp, sw, sh, true);
        int[] sPx = new int[sw * sh];
        lapBmp.getPixels(sPx, 0, sw, 0, 0, sw, sh);
        if (lapBmp != srcBmp) lapBmp.recycle();

        float[] gs = new float[sw * sh];
        for (int i = 0; i < sPx.length; i++) {
            int c = sPx[i];
            gs[i] = ((c >> 16) & 0xff) * 0.299f + ((c >> 8) & 0xff) * 0.587f + (c & 0xff) * 0.114f;
        }
        double lapAcc = 0.0;
        int lapCnt = 0;
        for (int y = 1; y < sh - 1; y++) {
            int rOff = y * sw;
            for (int x = 1; x < sw - 1; x++) {
                int idx = rOff + x;
                float lx = Math.abs(2.0f * gs[idx] - gs[idx - 1] - gs[idx + 1]);
                float ly = Math.abs(2.0f * gs[idx] - gs[idx - sw] - gs[idx + sw]);
                lapAcc += (lx + ly);
                lapCnt++;
            }
        }
        float sharpness = lapCnt > 0 ? (float) (lapAcc / lapCnt) : 0.0f;

        // 3) 최대 1920px · JPEG 품질 92 고선명 인코딩 (소형 컵·라벨 한글 자모 획 보존)
        int maxSide = Math.max(w, h);
        Bitmap targetBmp = srcBmp;
        Bitmap scaled = null;
        if (maxSide > 1920) {
            float fScale = 1920.0f / (float) maxSide;
            scaled = Bitmap.createScaledBitmap(srcBmp, Math.max(64, Math.round(w * fScale)), Math.max(64, Math.round(h * fScale)), true);
            targetBmp = scaled;
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream(98304);
        targetBmp.compress(Bitmap.CompressFormat.JPEG, 92, baos);
        if (scaled != null && scaled != srcBmp && !scaled.isRecycled()) {
            scaled.recycle();
        }
        return new VideoKeyframeCandidate(timeSec, lumaGrid, sharpness, baos.toByteArray());
    }

    @PluginMethod
    public void extractVideoKeyframes(PluginCall call) {
        Context ctx = getContext();
        String rawId = call.getString("id", "");
        final int maxFrames = Math.max(1, Math.min(10, call.getInt("maxFrames", 8)));
        final String digits = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (ctx == null || digits.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("ok", false);
            empty.put("frames", new JSArray());
            call.resolve(empty);
            return;
        }
        final Context appCtx = ctx.getApplicationContext();
        new Thread(() -> {
            JSArray framesArr = new JSArray();
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                long mediaId = Long.parseLong(digits);
                Uri videoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, mediaId);
                retriever.setDataSource(appCtx, videoUri);
                String durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                long durMs = 3000L;
                if (durStr != null && !durStr.trim().isEmpty()) {
                    try {
                        durMs = Math.max(500L, Long.parseLong(durStr.trim()));
                    } catch (NumberFormatException ignored) {
                    }
                }
                // 45초 이하 클립(예: 13초 컵 촬영 영상)에서 OPTION_CLOSEST_SYNC로 인해 손떨림 키프레임이 선택되던 병목을 제거하고,
                // 조밀 후보 스캔 후 장면 군집별 최고 Laplacian 선명도(초점 고정) 프레임만 선별 반환합니다.
                int candCount = durMs <= 2400L ? 4 : (durMs <= 7000L ? 8 : 12);
                int optMode = durMs <= 45000L
                    ? MediaMetadataRetriever.OPTION_CLOSEST
                    : MediaMetadataRetriever.OPTION_CLOSEST_SYNC;

                List<VideoKeyframeCandidate> candidates = new ArrayList<>();
                for (int i = 0; i < candCount; i++) {
                    double ratio = candCount == 1 ? 0.35 : (0.08 + 0.82 * ((double) i / (double) (candCount - 1)));
                    long sampleMs = Math.max(80L, Math.min(durMs - 120L, Math.round(durMs * ratio)));
                    Bitmap frame = null;
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                            frame = retriever.getScaledFrameAtTime(sampleMs * 1000L, optMode, 1920, 1920);
                        }
                        if (frame == null) {
                            frame = retriever.getFrameAtTime(sampleMs * 1000L, optMode);
                        }
                        if (frame == null && optMode != MediaMetadataRetriever.OPTION_CLOSEST_SYNC) {
                            frame = retriever.getFrameAtTime(sampleMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                        }
                        if (frame == null) continue;
                        VideoKeyframeCandidate cand = evaluateVideoFrameSharpness(frame, Math.max(0, (int) Math.round(sampleMs / 1000.0)));
                        if (cand != null) {
                            candidates.add(cand);
                        }
                    } catch (Throwable ignored) {
                    } finally {
                        if (frame != null && !frame.isRecycled()) {
                            try { frame.recycle(); } catch (Throwable ignored) {}
                        }
                    }
                }

                if (!candidates.isEmpty()) {
                    List<List<VideoKeyframeCandidate>> clusters = new ArrayList<>();
                    List<VideoKeyframeCandidate> firstCluster = new ArrayList<>();
                    firstCluster.add(candidates.get(0));
                    clusters.add(firstCluster);

                    for (int idx = 1; idx < candidates.size(); idx++) {
                        VideoKeyframeCandidate cur = candidates.get(idx);
                        List<VideoKeyframeCandidate> lastCl = clusters.get(clusters.size() - 1);
                        VideoKeyframeCandidate prev = lastCl.get(lastCl.size() - 1);
                        double diffAcc = 0.0;
                        for (int k = 0; k < cur.lumaGrid.length; k++) {
                            diffAcc += Math.abs(cur.lumaGrid[k] - prev.lumaGrid[k]);
                        }
                        float mad = (float) (diffAcc / cur.lumaGrid.length);
                        if (mad < 5.0f) {
                            lastCl.add(cur);
                        } else {
                            List<VideoKeyframeCandidate> nextCl = new ArrayList<>();
                            nextCl.add(cur);
                            clusters.add(nextCl);
                        }
                    }

                    List<VideoKeyframeCandidate> selected = new ArrayList<>();
                    for (List<VideoKeyframeCandidate> cl : clusters) {
                        VideoKeyframeCandidate best = cl.get(0);
                        for (int k = 1; k < cl.size(); k++) {
                            if (cl.get(k).sharpness > best.sharpness) {
                                best = cl.get(k);
                            }
                        }
                        selected.add(best);
                    }

                    // 단일 고정 피사체 영상(예: 13초 동안 컵 하나만 촬영해 클러스터가 1~2개뿐인 경우)에서도
                    // 가장 선명한 상위 3개 시점(돌려가며 찍은 측면 글자 포함)을 보강하여 모든 각도의 문장을 빠짐없이 포착합니다.
                    if (selected.size() < Math.min(3, candidates.size())) {
                        List<VideoKeyframeCandidate> bySharp = new ArrayList<>(candidates);
                        bySharp.sort((a, b) -> Float.compare(b.sharpness, a.sharpness));
                        for (VideoKeyframeCandidate cand : bySharp) {
                            if (selected.size() >= Math.min(4, maxFrames)) break;
                            boolean tooClose = false;
                            for (VideoKeyframeCandidate ex : selected) {
                                if (Math.abs(ex.timeSec - cand.timeSec) <= 1) {
                                    tooClose = true;
                                    break;
                                }
                            }
                            if (!tooClose) {
                                selected.add(cand);
                            }
                        }
                        selected.sort((a, b) -> Integer.compare(a.timeSec, b.timeSec));
                    }

                    int limit = Math.min(maxFrames, selected.size());
                    for (int i = 0; i < limit; i++) {
                        VideoKeyframeCandidate s = selected.get(i);
                        String dataUrl = "data:image/jpeg;base64," + Base64.encodeToString(s.jpegBytes, Base64.NO_WRAP);
                        JSObject fObj = new JSObject();
                        fObj.put("timeSec", s.timeSec);
                        fObj.put("dataUrl", dataUrl);
                        framesArr.put(fObj);
                    }
                }
            } catch (Throwable ignored) {
            } finally {
                try {
                    retriever.release();
                } catch (Throwable ignored) {
                }
            }
            JSObject ret = new JSObject();
            ret.put("ok", framesArr.length() > 0);
            ret.put("frames", framesArr);
            call.resolve(ret);
        }, "GhostiVidFrames").start();
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
