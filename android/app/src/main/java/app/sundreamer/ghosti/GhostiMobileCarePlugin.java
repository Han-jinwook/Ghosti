package app.sundreamer.ghosti;

import android.Manifest;
import android.app.Activity;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ClipboardManager;
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
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
import android.util.TypedValue;
import android.view.Gravity;
import android.view.Surface;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions;
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
import java.util.HashSet;
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
        final String action = call.getString("action", "move");
        final boolean isMoveToTrash = !"restore".equalsIgnoreCase(action);
        final JSArray items = call.getArray("items");
        if (items == null || items.length() == 0) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("canceled", false);
            ret.put("doneIds", new JSArray());
            call.resolve(ret);
            return;
        }

        final Context ctx = getContext();
        final ContentResolver resolver = ctx.getContentResolver();
        final Set<String> protectedKeepIdStrings = new LinkedHashSet<>();
        final Set<Long> protectedMediaIds = new LinkedHashSet<>();
        JSArray protectedKeepArr = call.getArray("protectedKeepIds");
        if (protectedKeepArr != null) {
            for (int i = 0; i < protectedKeepArr.length(); i++) {
                String keepRaw = protectedKeepArr.optString(i, "");
                if (keepRaw != null && !keepRaw.isEmpty()) {
                    protectedKeepIdStrings.add(keepRaw);
                    Long keepMid = extractNumericMediaStoreIdFromFileName(keepRaw);
                    if (keepMid != null && keepMid > 0) {
                        protectedMediaIds.add(keepMid);
                    }
                }
            }
        }

        final List<JSONObject> rawList = new ArrayList<>();
        final JSArray requestedIds = new JSArray();
        boolean needsMediaQuery = false;

        try {
            for (int i = 0; i < items.length(); i++) {
                JSONObject obj = items.optJSONObject(i);
                if (obj == null) continue;
                String id = obj.optString("id", "");
                String name = obj.optString("name", "");
                Long pickerMediaId = extractNumericMediaStoreIdFromFileName(id);
                if (pickerMediaId == null) {
                    pickerMediaId = extractNumericMediaStoreIdFromFileName(name);
                }
                if (isMoveToTrash) {
                    if ((!id.isEmpty() && protectedKeepIdStrings.contains(id))
                        || (!name.isEmpty() && protectedKeepIdStrings.contains(name))
                        || (pickerMediaId != null && protectedMediaIds.contains(pickerMediaId))) {
                        // 보존 베스트 사진(protectedKeepIds)은 어떤 경우에도 OS 휴지통 이동 목록에 포함 금지
                        continue;
                    }
                }
                rawList.add(obj);
                if (!id.isEmpty()) {
                    requestedIds.put(id);
                } else if (!name.isEmpty()) {
                    requestedIds.put(name);
                }
                if (pickerMediaId == null) {
                    needsMediaQuery = true;
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

        if (rawList.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("action", isMoveToTrash ? "move" : "restore");
            ret.put("canceled", false);
            ret.put("matchedMediaStoreCount", 0);
            ret.put("doneIds", new JSArray());
            call.resolve(ret);
            return;
        }

        if (needsMediaQuery && !hasMediaReadPermission(ctx) && !permissionAlreadyRequested) {
            String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "mediaModern" : "mediaLegacy";
            requestPermissionForAlias(alias, call, "onMediaImagesPermissionForTrash");
            return;
        }

        // [메인 UI 스레드 프리즈 0.0ms 정공법]
        // ContentResolver.query IPC 및 MediaStore.createTrashRequest 생성을 전용 워커 스레드에서 수행하고,
        // 시스템 확인 팝업(launchMediaStoreIntentSender)만 UI 스레드로 마샬링합니다.
        new Thread(() -> {
            final List<Uri> targetUris = new ArrayList<>();
            final JSObject replacedIdsObj = new JSObject();
            final List<JSONObject> trackedRestoreItems = new ArrayList<>();
            final Set<Long> seenMediaIds = new LinkedHashSet<>();

            try {
                for (JSONObject obj : rawList) {
                    String id = obj.optString("id", "");
                    String name = obj.optString("name", "");
                    long size = obj.optLong("size", -1L);
                    Long mediaId = extractNumericMediaStoreIdFromFileName(id);
                    if (mediaId == null) {
                        mediaId = extractNumericMediaStoreIdFromFileName(name);
                    }

                    Set<Long> queryExcludeIds = new LinkedHashSet<>(seenMediaIds);
                    if (isMoveToTrash) {
                        queryExcludeIds.addAll(protectedMediaIds);
                    }

                    if (mediaId != null && mediaId > 0) {
                        if (isMoveToTrash && protectedMediaIds.contains(mediaId)) {
                            continue;
                        }
                        int rowState = queryMediaStoreIdTrashState(resolver, mediaId);
                        if (isMoveToTrash && rowState == 1) {
                            // 이미 OS 휴지통(IS_TRASHED=1)에 들어가 있는 항목은 중복 요청 없이 완료 처리
                            continue;
                        }
                        if (!isMoveToTrash && rowState == 0) {
                            // 이미 활성 갤러리(IS_TRASHED=0)로 복원되어 있는 항목은 중복 요청 생략
                            continue;
                        }
                        if (rowState == -1) {
                            // 반복 이동·복원 중 MediaProvider가 새 _ID를 부여한 경우 파일명(+용량)으로 재탐색 (보존 베스트 ID는 절대 제외)
                            Long reboundId = queryMediaStoreIdForPhoto(resolver, name, size, !isMoveToTrash, queryExcludeIds);
                            if (reboundId != null && reboundId > 0) {
                                mediaId = reboundId;
                                if (!id.isEmpty()) {
                                    replacedIdsObj.put(id, "ms_img_" + reboundId);
                                }
                            } else {
                                mediaId = null;
                            }
                        }
                    } else {
                        mediaId = queryMediaStoreIdForPhoto(resolver, name, size, !isMoveToTrash, queryExcludeIds);
                    }

                    if (mediaId != null && mediaId > 0 && (!isMoveToTrash || !protectedMediaIds.contains(mediaId)) && seenMediaIds.add(mediaId)) {
                        targetUris.add(ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId));
                        if (!isMoveToTrash) {
                            JSONObject track = new JSONObject();
                            track.put("reqId", id);
                            track.put("mediaId", mediaId);
                            track.put("name", name);
                            track.put("size", size);
                            trackedRestoreItems.add(track);
                        }
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
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("action", isMoveToTrash ? "move" : "restore");
                ret.put("canceled", false);
                ret.put("matchedMediaStoreCount", 0);
                ret.put("doneIds", requestedIds);
                ret.put("replacedIds", replacedIdsObj);
                call.resolve(ret);
                return;
            }

            try {
                final PendingIntent pi = MediaStore.createTrashRequest(resolver, targetUris, isMoveToTrash);
                final Activity act = getActivity();
                if (act instanceof MainActivity) {
                    final int matchedCount = targetUris.size();
                    act.runOnUiThread(() -> {
                        try {
                            ((MainActivity) act).launchMediaStoreIntentSender(pi.getIntentSender(), (resultCode, data) -> {
                                final boolean approved = (resultCode == Activity.RESULT_OK);
                                if (approved && !isMoveToTrash && !trackedRestoreItems.isEmpty()) {
                                    new Thread(() -> {
                                        for (JSONObject tr : trackedRestoreItems) {
                                            String reqId = tr.optString("reqId", "");
                                            long oldMid = tr.optLong("mediaId", -1L);
                                            String tName = tr.optString("name", "");
                                            long tSize = tr.optLong("size", -1L);
                                            if (!reqId.isEmpty() && oldMid > 0 && queryMediaStoreIdTrashState(resolver, oldMid) != 0) {
                                                Long activeMid = queryMediaStoreIdForPhoto(resolver, tName, tSize, false, null);
                                                if (activeMid != null && activeMid > 0 && activeMid != oldMid) {
                                                    replacedIdsObj.put(reqId, "ms_img_" + activeMid);
                                                }
                                            }
                                        }
                                        JSObject ret = new JSObject();
                                        ret.put("ok", true);
                                        ret.put("action", "restore");
                                        ret.put("canceled", false);
                                        ret.put("matchedMediaStoreCount", matchedCount);
                                        ret.put("doneIds", requestedIds);
                                        ret.put("replacedIds", replacedIdsObj);
                                        call.resolve(ret);
                                    }, "GhostiRestoreVerifyWorker").start();
                                    return;
                                }
                                JSObject ret = new JSObject();
                                ret.put("ok", approved);
                                ret.put("action", isMoveToTrash ? "move" : "restore");
                                ret.put("canceled", !approved);
                                ret.put("matchedMediaStoreCount", matchedCount);
                                ret.put("doneIds", approved ? requestedIds : new JSArray());
                                ret.put("replacedIds", replacedIdsObj);
                                call.resolve(ret);
                            });
                        } catch (Exception launchErr) {
                            JSObject ret = new JSObject();
                            ret.put("ok", false);
                            ret.put("canceled", false);
                            ret.put("doneIds", new JSArray());
                            ret.put("error", "LAUNCH_TRASH_INTENT_FAILED: " + launchErr.getMessage());
                            call.resolve(ret);
                        }
                    });
                } else {
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    ret.put("action", isMoveToTrash ? "move" : "restore");
                    ret.put("canceled", false);
                    ret.put("matchedMediaStoreCount", 0);
                    ret.put("doneIds", requestedIds);
                    ret.put("replacedIds", replacedIdsObj);
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
        }, "GhostiTrashWorker").start();
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

    private int queryMediaStoreIdTrashState(ContentResolver resolver, long mediaId) {
        if (mediaId <= 0) return -1;
        try {
            Uri itemUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId);
            String[] proj = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? new String[] { MediaStore.Images.Media._ID, MediaStore.Images.Media.IS_TRASHED }
                : new String[] { MediaStore.Images.Media._ID };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Bundle args = new Bundle();
                args.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE);
                try (Cursor c = resolver.query(itemUri, proj, args, null)) {
                    if (c != null && c.moveToFirst()) {
                        return c.getInt(1) == 1 ? 1 : 0;
                    }
                }
            } else {
                try (Cursor c = resolver.query(itemUri, proj, null, null, null)) {
                    if (c != null && c.moveToFirst()) {
                        return 0;
                    }
                }
            }
        } catch (Throwable ignored) {
        }
        return -1;
    }

    private Long queryMediaStoreIdForPhoto(
        ContentResolver resolver,
        String fileName,
        long fileSize,
        boolean trashedOnly,
        Set<Long> excludedIds
    ) {
        if (fileName == null || fileName.isEmpty()) return null;
        try {
            String[] projection = new String[] {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.SIZE
            };
            // 1차: 파일명 + 파일 크기 동시 일치 조회 (보존 베스트 ID 및 기선택 ID는 제외하여 쌍둥이 원본 오타격 원천 차단)
            if (fileSize > 0) {
                Bundle exactArgs = new Bundle();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    exactArgs.putInt(
                        MediaStore.QUERY_ARG_MATCH_TRASHED,
                        trashedOnly ? MediaStore.MATCH_ONLY : MediaStore.MATCH_EXCLUDE
                    );
                }
                exactArgs.putString(
                    ContentResolver.QUERY_ARG_SQL_SELECTION,
                    MediaStore.Images.Media.DISPLAY_NAME + " = ? AND " + MediaStore.Images.Media.SIZE + " = ?"
                );
                exactArgs.putStringArray(
                    ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
                    new String[] { fileName, String.valueOf(fileSize) }
                );
                try (Cursor c = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, exactArgs, null)) {
                    if (c != null) {
                        while (c.moveToNext()) {
                            long candId = c.getLong(0);
                            if (candId > 0 && (excludedIds == null || !excludedIds.contains(candId))) {
                                return candId;
                            }
                        }
                    }
                }
            }
            // 2차: 파일명 일치 조회 (파일명 없이 SIZE 단독 조회는 영구 금지하며, 보존 베스트 ID 제외)
            Bundle nameArgs = new Bundle();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                nameArgs.putInt(
                    MediaStore.QUERY_ARG_MATCH_TRASHED,
                    trashedOnly ? MediaStore.MATCH_ONLY : MediaStore.MATCH_EXCLUDE
                );
            }
            nameArgs.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, MediaStore.Images.Media.DISPLAY_NAME + " = ?");
            nameArgs.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, new String[] { fileName });
            try (Cursor c = resolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, nameArgs, null)) {
                if (c != null) {
                    while (c.moveToNext()) {
                        long candId = c.getLong(0);
                        if (candId > 0 && (excludedIds == null || !excludedIds.contains(candId))) {
                            return candId;
                        }
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
                            if (rawRef != null && rawRef.contains("workRoom=")) {
                                resolvedInviteUrl = "ghosti://work?" + rawRef;
                            } else if (rawRef != null && rawRef.contains("invite=")) {
                                resolvedInviteUrl = "ghosti://invite?" + rawRef;
                            } else if (rawRef != null && rawRef.contains("pairCode=")) {
                                resolvedInviteUrl = "ghosti://pair?" + rawRef;
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

    private static volatile String sLastInjectedClipHash = "";
    private static volatile long sLastInjectedClipAtMs = 0L;

    private static String sha256HexUtf8(String input) {
        if (input == null || input.isEmpty()) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Throwable ignored) {
            return "";
        }
    }

    @PluginMethod
    public void readClipboardText(PluginCall call) {
        final Context ctx = getContext();
        if (ctx == null) {
            JSObject empty = new JSObject();
            empty.put("ok", false);
            empty.put("text", "");
            empty.put("clipHash", "");
            empty.put("isSelfInjected", false);
            call.resolve(empty);
            return;
        }
        new Handler(android.os.Looper.getMainLooper()).post(() -> {
            String text = "";
            try {
                ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null && cm.hasPrimaryClip()) {
                    ClipData clip = cm.getPrimaryClip();
                    if (clip != null && clip.getItemCount() > 0) {
                        CharSequence seq = clip.getItemAt(0).coerceToText(ctx);
                        if (seq != null) {
                            text = seq.toString().trim();
                            if (text.length() > 32000) {
                                text = text.substring(0, 32000);
                            }
                        }
                    }
                }
            } catch (Throwable ignored) {
                text = "";
            }
            String hash = sha256HexUtf8(text);
            boolean isSelf = !hash.isEmpty()
                    && hash.equals(sLastInjectedClipHash)
                    && (System.currentTimeMillis() - sLastInjectedClipAtMs) < 60_000L;
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("text", text);
            ret.put("clipHash", hash);
            ret.put("isSelfInjected", isSelf);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void writeClipboardText(PluginCall call) {
        final Context ctx = getContext();
        String raw = call.getString("text");
        final String clean = raw != null ? raw.trim() : "";
        if (ctx == null || clean.isEmpty()) {
            JSObject fail = new JSObject();
            fail.put("ok", false);
            fail.put("clipHash", "");
            call.resolve(fail);
            return;
        }
        final String limited = clean.length() > 32000 ? clean.substring(0, 32000) : clean;
        final String hash = sha256HexUtf8(limited);
        new Handler(android.os.Looper.getMainLooper()).post(() -> {
            boolean ok = false;
            try {
                Activity act = getActivity();
                if (act == null || act.isFinishing() || act.isDestroyed()) {
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("clipHash", hash);
                    ret.put("reason", "ACTIVITY_NOT_ACTIVE");
                    call.resolve(ret);
                    return;
                }
                ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) {
                    cm.setPrimaryClip(ClipData.newPlainText("Ghosti", limited));
                    ok = true;
                }
            } catch (Throwable ignored) {
                ok = false;
            }
            if (ok) {
                sLastInjectedClipHash = hash;
                sLastInjectedClipAtMs = System.currentTimeMillis();
            }
            JSObject ret = new JSObject();
            ret.put("ok", ok);
            ret.put("clipHash", hash);
            call.resolve(ret);
        });
    }

    // =========================================================================
    // [모바일 정공법 — 대안 B]:
    // 1) OS 네이티브 온디바이스 한글 OCR (Google ML Kit Korean v2 번들, 오프라인 NPU 0.2~0.4초)
    // 2) OS 순정 하드웨어 VideoView + 하단 추출 한글·복사 통합 모달 (무변환 0.05초 즉시 재생)
    // =========================================================================
    private static volatile TextRecognizer sKoreanTextRecognizer = null;
    private static final Object KOREAN_OCR_LOCK = new Object();
    private static final Map<Long, NativeVideoOcrResult> sNativeVideoOcrCache = new ConcurrentHashMap<>();
    private static final Pattern WATERMARK_NOISE_RX = Pattern.compile(
        "(?i)(notebooklm|^capcut$|^veo$|^kapwing$|^[xyv]?rec[eo@0]rder$|mobizen|bandicam|gomcam|^ocam$|az\\s*screen|^inshot$|kinemaster|vivavideo|filmora)"
    );
    private static final Pattern STATUS_BAR_NOISE_RX = Pattern.compile(
        "(?i)^(?:SKT|KT|LG\\s*U\\+|U\\+|LTE|5G|\\d{1,3}%|\\d{1,2}:\\d{2})$"
    );
    private static final Pattern KBD_TOKEN_NOISE_RX = Pattern.compile(
        "(?i)^(?:스페이스|한/?영|완료|이동|검색|123|!#1|!#7|[ㄱ-ㅎㅏ-ㅣ]{1,3})$"
    );

    private static class NativeOcrLineEntry {
        final int timeSec;
        final String timestamp;
        final String text;

        NativeOcrLineEntry(int timeSec, String timestamp, String text) {
            this.timeSec = timeSec;
            this.timestamp = timestamp;
            this.text = text;
        }
    }

    private static class NativeVideoOcrResult {
        final boolean hasText;
        final List<NativeOcrLineEntry> lines;
        final String fullText;

        NativeVideoOcrResult(boolean hasText, List<NativeOcrLineEntry> lines, String fullText) {
            this.hasText = hasText;
            this.lines = lines;
            this.fullText = fullText;
        }

        JSObject toJSObject() {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("hasText", hasText);
            JSArray arr = new JSArray();
            for (NativeOcrLineEntry item : lines) {
                JSObject o = new JSObject();
                o.put("timeSec", item.timeSec);
                o.put("timestamp", item.timestamp);
                o.put("text", item.text);
                arr.put(o);
            }
            ret.put("ocrLines", arr);
            ret.put("fullText", fullText);
            return ret;
        }
    }

    private static TextRecognizer getKoreanRecognizer() {
        if (sKoreanTextRecognizer == null) {
            synchronized (KOREAN_OCR_LOCK) {
                if (sKoreanTextRecognizer == null) {
                    sKoreanTextRecognizer = TextRecognition.getClient(
                        new KoreanTextRecognizerOptions.Builder().build()
                    );
                }
            }
        }
        return sKoreanTextRecognizer;
    }

    private static String formatMmSs(int secVal) {
        int s = Math.max(0, secVal);
        return String.format(Locale.US, "%02d:%02d", s / 60, s % 60);
    }

    private static class CleanedFrameOcr {
        final String text;
        final float qualityScore;
        final String normSig;

        CleanedFrameOcr(String text, float qualityScore, String normSig) {
            this.text = text;
            this.qualityScore = qualityScore;
            this.normSig = normSig;
        }
    }

    private static double computeBigramOverlap(String a, String b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) return 0.0;
        if (a.equals(b)) return 1.0;
        if (a.length() >= 4 && b.contains(a)) return 0.92;
        if (b.length() >= 4 && a.contains(b)) return 0.92;
        Set<String> setA = new HashSet<>();
        for (int i = 0; i < a.length() - 1; i++) {
            setA.add(a.substring(i, i + 2));
        }
        Set<String> setB = new HashSet<>();
        for (int i = 0; i < b.length() - 1; i++) {
            setB.add(b.substring(i, i + 2));
        }
        if (setA.isEmpty() || setB.isEmpty()) return 0.0;
        int inter = 0;
        for (String bg : setA) {
            if (setB.contains(bg)) inter++;
        }
        return (double) inter / (double) Math.max(1, Math.min(setA.size(), setB.size()));
    }

    private static CleanedFrameOcr cleanRecognizedFrameText(Text visionText, int imgHeight) {
        if (visionText == null) return new CleanedFrameOcr("", 0f, "");
        List<Text.Line> allLines = new ArrayList<>();
        for (Text.TextBlock block : visionText.getTextBlocks()) {
            if (block != null && block.getLines() != null) {
                allLines.addAll(block.getLines());
            }
        }
        if (allLines.isEmpty()) return new CleanedFrameOcr("", 0f, "");

        allLines.sort((a, b) -> {
            android.graphics.Rect ra = a.getBoundingBox();
            android.graphics.Rect rb = b.getBoundingBox();
            if (ra == null || rb == null) return 0;
            int dy = Math.abs(ra.centerY() - rb.centerY());
            int minH = Math.max(12, Math.min(ra.height(), rb.height()));
            if (dy <= minH / 2) {
                return Integer.compare(ra.left, rb.left);
            }
            return Integer.compare(ra.top, rb.top);
        });

        List<String> kept = new ArrayList<>();
        Set<String> seenInFrame = new LinkedHashSet<>();
        float totalQuality = 0f;

        for (Text.Line line : allLines) {
            if (line == null) continue;
            Float lineConfObj = line.getConfidence();
            float lineConf = (lineConfObj != null && lineConfObj > 0f) ? lineConfObj : 0.80f;
            // 모션 블러·배경 노이즈로 인한 저신뢰도 오인식 라인 원천 컷오프
            if (lineConf < 0.68f) continue;

            List<Text.Element> elements = line.getElements();
            String raw;
            if (elements != null && !elements.isEmpty()) {
                StringBuilder elemSb = new StringBuilder();
                for (Text.Element el : elements) {
                    if (el == null) continue;
                    Float elConfObj = el.getConfidence();
                    float elConf = (elConfObj != null && elConfObj > 0f) ? elConfObj : lineConf;
                    if (elConf < 0.62f) continue;
                    String elTxt = el.getText();
                    if (elTxt == null) continue;
                    // 낱글자 자모 파편 및 깨진 특수기호 제거
                    String elClean = elTxt.replaceAll("[ㄱ-ㅎㅏ-ㅣ~`^|\\\\<>{}\\[\\]©®™]+", "").trim();
                    if (elClean.isEmpty()) continue;
                    // 신뢰도가 낮은 1글자 영문/기호 노이즈 차단
                    if (elClean.length() == 1 && elConf < 0.80f && !(elClean.charAt(0) >= 0xAC00 && elClean.charAt(0) <= 0xD7A3) && !Character.isDigit(elClean.charAt(0))) {
                        continue;
                    }
                    if (elemSb.length() > 0) elemSb.append(' ');
                    elemSb.append(elClean);
                }
                raw = elemSb.toString();
            } else {
                raw = line.getText();
            }
            if (raw == null) continue;
            String cleaned = raw
                .replaceAll("[ㄱ-ㅎㅏ-ㅣ~`^|\\\\<>{}\\[\\]©®™]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
            if (cleaned.length() < 2) continue;

            android.graphics.Rect box = line.getBoundingBox();
            if (box != null && imgHeight > 0 && box.bottom <= Math.round(imgHeight * 0.055f)) {
                if (STATUS_BAR_NOISE_RX.matcher(cleaned).matches()) continue;
            }
            if (WATERMARK_NOISE_RX.matcher(cleaned).find()) continue;
            if (KBD_TOKEN_NOISE_RX.matcher(cleaned).matches()) continue;

            int koreanCount = 0;
            int alnumCount = 0;
            int symbolCount = 0;
            for (int ci = 0; ci < cleaned.length(); ci++) {
                char ch = cleaned.charAt(ci);
                if (ch >= 0xAC00 && ch <= 0xD7A3) {
                    koreanCount++;
                } else if (Character.isLetterOrDigit(ch)) {
                    alnumCount++;
                } else if (!Character.isWhitespace(ch)) {
                    symbolCount++;
                }
            }
            // 의미 있는 한글 2자 이상(또는 고신뢰도 한글 1자+영숫자) 또는 영숫자 3자 이상만 채택
            int meaningfulScore = koreanCount * 2 + alnumCount;
            if (koreanCount == 0 && alnumCount < 3) continue;
            if (koreanCount == 1 && alnumCount == 0 && lineConf < 0.85f) continue;
            if (symbolCount > koreanCount + alnumCount) continue;

            String normKey = cleaned.toLowerCase(Locale.ROOT).replaceAll("[^가-힣a-z0-9]+", "");
            if (normKey.length() < 2) continue;
            if (seenInFrame.add(normKey)) {
                kept.add(cleaned);
                totalQuality += (meaningfulScore * lineConf);
            }
        }
        if (kept.isEmpty()) return new CleanedFrameOcr("", 0f, "");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < kept.size(); i++) {
            if (i > 0) sb.append(" · ");
            sb.append(kept.get(i));
        }
        String fullLine = sb.toString();
        String normSig = fullLine.toLowerCase(Locale.ROOT).replaceAll("[^가-힣a-z0-9]+", "");
        return new CleanedFrameOcr(fullLine, totalQuality, normSig);
    }

    private NativeVideoOcrResult extractNativeVideoOcrInternal(Context appCtx, long mediaId, int maxFrames) {
        NativeVideoOcrResult cached = sNativeVideoOcrCache.get(mediaId);
        if (cached != null) {
            return cached;
        }
        List<NativeOcrLineEntry> entries = new ArrayList<>();
        List<String> entryNormSigs = new ArrayList<>();
        List<Float> entryQualities = new ArrayList<>();
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
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
            int totalSec = Math.max(1, (int) Math.floor(durMs / 1000.0));
            int targetCap = Math.max(4, Math.min(12, maxFrames));
            Set<Integer> candidateSecsSet = new LinkedHashSet<>();
            if (totalSec <= targetCap) {
                for (int s = 0; s <= totalSec; s++) {
                    if (s * 1000L <= durMs - 120L || s == 0) {
                        candidateSecsSet.add(s);
                    }
                }
            } else {
                for (int i = 0; i < targetCap; i++) {
                    double ratio = targetCap == 1 ? 0.0 : ((double) i / (double) (targetCap - 1));
                    int sec = Math.max(0, Math.min(totalSec, (int) Math.round(totalSec * ratio)));
                    candidateSecsSet.add(sec);
                }
            }

            TextRecognizer recognizer = getKoreanRecognizer();
            for (int sec : candidateSecsSet) {
                // 정확한 정수 초(sec * 1000ms) 지점의 실제 프레임을 OPTION_CLOSEST로 추출하여 1초 앞당김 오차 원천 차단
                long sampleMs = sec == 0 ? Math.min(120L, durMs / 2) : Math.min(durMs - 80L, sec * 1000L);
                Bitmap bmp = null;
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                        bmp = retriever.getScaledFrameAtTime(
                            sampleMs * 1000L,
                            MediaMetadataRetriever.OPTION_CLOSEST,
                            1920,
                            1920
                        );
                    }
                    if (bmp == null) {
                        bmp = retriever.getFrameAtTime(sampleMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST);
                    }
                    if (bmp == null) {
                        bmp = retriever.getFrameAtTime(sampleMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                    }
                    if (bmp == null) continue;

                    InputImage inputImage = InputImage.fromBitmap(bmp, 0);
                    Text visionRes = Tasks.await(recognizer.process(inputImage), 4, TimeUnit.SECONDS);
                    CleanedFrameOcr cleaned = cleanRecognizedFrameText(visionRes, bmp.getHeight());
                    if (!cleaned.text.isEmpty() && !cleaned.normSig.isEmpty()) {
                        if (!entries.isEmpty()) {
                            int lastIdx = entries.size() - 1;
                            String prevSig = entryNormSigs.get(lastIdx);
                            double overlap = computeBigramOverlap(prevSig, cleaned.normSig);
                            if (overlap >= 0.72) {
                                // 동일 자막/장면 구간에서는 더 선명하고 신뢰도·글자수가 높은 프레임의 텍스트로 교체하되 시작 초(timeSec)는 유지
                                if (cleaned.qualityScore > entryQualities.get(lastIdx) * 1.03f) {
                                    NativeOcrLineEntry prevEntry = entries.get(lastIdx);
                                    entries.set(lastIdx, new NativeOcrLineEntry(prevEntry.timeSec, prevEntry.timestamp, cleaned.text));
                                    entryNormSigs.set(lastIdx, cleaned.normSig);
                                    entryQualities.set(lastIdx, cleaned.qualityScore);
                                }
                                continue;
                            }
                        }
                        entries.add(new NativeOcrLineEntry(sec, formatMmSs(sec), cleaned.text));
                        entryNormSigs.add(cleaned.normSig);
                        entryQualities.add(cleaned.qualityScore);
                    }
                } catch (Throwable ignored) {
                } finally {
                    if (bmp != null && !bmp.isRecycled()) {
                        try { bmp.recycle(); } catch (Throwable ignored) {}
                    }
                }
            }
        } catch (Throwable err) {
            android.util.Log.w("GhostiVidOcr", "extractNativeVideoOcrInternal failed for mediaId=" + mediaId, err);
        } finally {
            try { retriever.release(); } catch (Throwable ignored) {}
        }

        StringBuilder fullSb = new StringBuilder();
        for (int i = 0; i < entries.size(); i++) {
            if (i > 0) fullSb.append('\n');
            NativeOcrLineEntry e = entries.get(i);
            fullSb.append('[').append(e.timestamp).append("] ").append(e.text);
        }
        NativeVideoOcrResult out = new NativeVideoOcrResult(!entries.isEmpty(), entries, fullSb.toString());
        sNativeVideoOcrCache.put(mediaId, out);
        return out;
    }

    @PluginMethod
    public void extractVideoNativeOcr(PluginCall call) {
        Context ctx = getContext();
        String rawId = call.getString("id", "");
        final int maxFrames = Math.max(1, Math.min(12, call.getInt("maxFrames", 8)));
        final String digits = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (ctx == null || digits.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("ok", false);
            empty.put("hasText", false);
            empty.put("ocrLines", new JSArray());
            empty.put("fullText", "");
            call.resolve(empty);
            return;
        }
        final Context appCtx = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                long mediaId = Long.parseLong(digits);
                NativeVideoOcrResult res = extractNativeVideoOcrInternal(appCtx, mediaId, maxFrames);
                call.resolve(res.toJSObject());
            } catch (Throwable err) {
                JSObject fail = new JSObject();
                fail.put("ok", false);
                fail.put("hasText", false);
                fail.put("ocrLines", new JSArray());
                fail.put("fullText", "");
                call.resolve(fail);
            }
        }, "GhostiNativeVideoOcr").start();
    }

    private int dpToPx(Context ctx, float dp) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, ctx.getResources().getDisplayMetrics()));
    }

    @PluginMethod
    public void openNativeVideoPlayerModal(PluginCall call) {
        final Activity activity = getActivity();
        final String rawId = call.getString("id", "");
        final String title = call.getString("title", "내 스마트폰 동영상");
        final String durationText = call.getString("durationText", "");
        final int initialSeekSec = Math.max(0, call.getInt("seekSec", 0));
        final JSArray preloadedArr = call.getArray("ocrLines");
        final String digits = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (activity == null || activity.isFinishing() || digits.isEmpty()) {
            JSObject fail = new JSObject();
            fail.put("ok", false);
            call.resolve(fail);
            return;
        }
        final long mediaId;
        try {
            mediaId = Long.parseLong(digits);
        } catch (NumberFormatException e) {
            JSObject fail = new JSObject();
            fail.put("ok", false);
            call.resolve(fail);
            return;
        }

        final List<NativeOcrLineEntry> initialLines = new ArrayList<>();
        if (preloadedArr != null) {
            try {
                for (int i = 0; i < preloadedArr.length(); i++) {
                    JSONObject obj = preloadedArr.getJSONObject(i);
                    if (obj == null) continue;
                    String tx = obj.optString("text", "").trim();
                    if (tx.isEmpty()) continue;
                    int tsSec = Math.max(0, obj.optInt("timeSec", 0));
                    String tsStr = obj.optString("timestamp", formatMmSs(tsSec));
                    initialLines.add(new NativeOcrLineEntry(tsSec, tsStr, tx));
                }
            } catch (Throwable ignored) {
            }
        }

        activity.runOnUiThread(() -> {
            final boolean[] resolvedOnce = new boolean[] { false };
            final NativeVideoOcrResult[] latestOcrHolder = new NativeVideoOcrResult[] {
                !initialLines.isEmpty()
                    ? new NativeVideoOcrResult(true, initialLines, "")
                    : sNativeVideoOcrCache.get(mediaId)
            };

            final Dialog dialog = new Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            Window win = dialog.getWindow();
            if (win != null) {
                win.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                win.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    win.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    win.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                    win.setStatusBarColor(Color.parseColor("#090D16"));
                    win.setNavigationBarColor(Color.parseColor("#090D16"));
                }
            }

            LinearLayout root = new LinearLayout(activity);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(Color.parseColor("#090D16"));
            int padH = dpToPx(activity, 14);
            int padTopFallback = dpToPx(activity, 16);
            int padBotFallback = dpToPx(activity, 14);
            root.setPadding(padH, padTopFallback, padH, padBotFallback);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                root.setOnApplyWindowInsetsListener((v, insets) -> {
                    int topInset = insets.getSystemWindowInsetTop();
                    int botInset = insets.getSystemWindowInsetBottom();
                    v.setPadding(
                        padH,
                        Math.max(padTopFallback, topInset + dpToPx(activity, 8)),
                        padH,
                        Math.max(padBotFallback, botInset + dpToPx(activity, 10))
                    );
                    return insets;
                });
            }

            // 1) 상단 헤더 (제목 + 길이 배지 + 닫기 버튼)
            LinearLayout header = new LinearLayout(activity);
            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setGravity(Gravity.CENTER_VERTICAL);
            LinearLayout.LayoutParams headerLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            );
            headerLp.bottomMargin = dpToPx(activity, 10);
            header.setLayoutParams(headerLp);

            LinearLayout titleCol = new LinearLayout(activity);
            titleCol.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams titleColLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
            titleColLp.rightMargin = dpToPx(activity, 10);
            titleCol.setLayoutParams(titleColLp);

            final TextView titleTv = new TextView(activity);
            titleTv.setText(title);
            titleTv.setTextColor(Color.WHITE);
            titleTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16.5f);
            titleTv.setTypeface(Typeface.DEFAULT_BOLD);
            titleTv.setMaxLines(2);
            titleCol.addView(titleTv);

            TextView subTv = new TextView(activity);
            subTv.setText(durationText.isEmpty() ? "🎬 스마트폰 원본 하드웨어 즉시 재생" : "⏱️ 전체 길이 " + durationText + " · 원본 무변환 즉시 재생");
            subTv.setTextColor(Color.parseColor("#94A3B8"));
            subTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.0f);
            titleCol.addView(subTv);
            header.addView(titleCol);

            TextView closeBtn = new TextView(activity);
            closeBtn.setText("✕ 닫기");
            closeBtn.setTextColor(Color.WHITE);
            closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
            closeBtn.setTypeface(Typeface.DEFAULT_BOLD);
            closeBtn.setGravity(Gravity.CENTER);
            closeBtn.setPadding(dpToPx(activity, 14), dpToPx(activity, 9), dpToPx(activity, 14), dpToPx(activity, 9));
            GradientDrawable closeBg = new GradientDrawable();
            closeBg.setColor(Color.parseColor("#1E293B"));
            closeBg.setCornerRadius(dpToPx(activity, 20));
            closeBg.setStroke(dpToPx(activity, 1), Color.parseColor("#475569"));
            closeBtn.setBackground(closeBg);
            closeBtn.setOnClickListener(v -> dialog.dismiss());
            header.addView(closeBtn);
            root.addView(header);

            // 2) 중앙 OS 순정 하드웨어 VideoView 플레이어 영역
            FrameLayout playerBox = new FrameLayout(activity);
            LinearLayout.LayoutParams playerBoxLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f
            );
            playerBoxLp.bottomMargin = dpToPx(activity, 12);
            playerBox.setLayoutParams(playerBoxLp);
            GradientDrawable playerBg = new GradientDrawable();
            playerBg.setColor(Color.BLACK);
            playerBg.setCornerRadius(dpToPx(activity, 16));
            playerBg.setStroke(dpToPx(activity, 1), Color.parseColor("#334155"));
            playerBox.setBackground(playerBg);

            final VideoView videoView = new VideoView(activity);
            FrameLayout.LayoutParams vvLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            );
            videoView.setLayoutParams(vvLp);
            playerBox.addView(videoView);

            final MediaController mediaController = new MediaController(activity);
            mediaController.setAnchorView(playerBox);
            videoView.setMediaController(mediaController);

            Uri directVideoUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, mediaId);
            final android.media.MediaPlayer[] mpHolder = new android.media.MediaPlayer[] { null };
            videoView.setVideoURI(directVideoUri);
            videoView.setOnPreparedListener(mp -> {
                try {
                    mpHolder[0] = mp;
                    mp.setLooping(false);
                    if (initialSeekSec > 0) {
                        long targetMs = initialSeekSec * 1000L;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            mp.seekTo(targetMs, android.media.MediaPlayer.SEEK_CLOSEST);
                        } else {
                            videoView.seekTo((int) targetMs);
                        }
                    }
                    videoView.start();
                } catch (Throwable ignored) {
                }
            });
            root.addView(playerBox);

            // 3) 하단 영상 속 한글 추출 결과 & 복사 패널
            LinearLayout ocrCard = new LinearLayout(activity);
            ocrCard.setOrientation(LinearLayout.VERTICAL);
            int cardMaxH = Math.round(activity.getResources().getDisplayMetrics().heightPixels * 0.31f);
            LinearLayout.LayoutParams ocrCardLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            ocrCard.setLayoutParams(ocrCardLp);
            int cardPad = dpToPx(activity, 12);
            ocrCard.setPadding(cardPad, cardPad, cardPad, cardPad);
            GradientDrawable ocrCardBg = new GradientDrawable();
            ocrCardBg.setColor(Color.parseColor("#111827"));
            ocrCardBg.setCornerRadius(dpToPx(activity, 16));
            ocrCardBg.setStroke(dpToPx(activity, 1), Color.parseColor("#14B8A6"));
            ocrCard.setBackground(ocrCardBg);

            LinearLayout ocrHeader = new LinearLayout(activity);
            ocrHeader.setOrientation(LinearLayout.HORIZONTAL);
            ocrHeader.setGravity(Gravity.CENTER_VERTICAL);
            LinearLayout.LayoutParams ocrHeaderLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            );
            ocrHeaderLp.bottomMargin = dpToPx(activity, 8);
            ocrHeader.setLayoutParams(ocrHeaderLp);

            final TextView ocrTitleTv = new TextView(activity);
            ocrTitleTv.setText("📝 영상 화면 속 한글 자동 추출");
            ocrTitleTv.setTextColor(Color.parseColor("#5EEAD4"));
            ocrTitleTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
            ocrTitleTv.setTypeface(Typeface.DEFAULT_BOLD);
            ocrTitleTv.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f));
            ocrHeader.addView(ocrTitleTv);

            final TextView copyAllBtn = new TextView(activity);
            copyAllBtn.setText("📋 전체 복사");
            copyAllBtn.setTextColor(Color.parseColor("#0F172A"));
            copyAllBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.0f);
            copyAllBtn.setTypeface(Typeface.DEFAULT_BOLD);
            copyAllBtn.setPadding(dpToPx(activity, 11), dpToPx(activity, 5), dpToPx(activity, 11), dpToPx(activity, 5));
            GradientDrawable copyBg = new GradientDrawable();
            copyBg.setColor(Color.parseColor("#2DD4BF"));
            copyBg.setCornerRadius(dpToPx(activity, 14));
            copyAllBtn.setBackground(copyBg);
            copyAllBtn.setVisibility(View.GONE);
            ocrHeader.addView(copyAllBtn);
            ocrCard.addView(ocrHeader);

            ScrollView ocrScroll = new ScrollView(activity) {
                @Override
                protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
                    int cappedSpec = MeasureSpec.makeMeasureSpec(cardMaxH, MeasureSpec.AT_MOST);
                    super.onMeasure(widthMeasureSpec, cappedSpec);
                }
            };
            final LinearLayout linesContainer = new LinearLayout(activity);
            linesContainer.setOrientation(LinearLayout.VERTICAL);
            ocrScroll.addView(linesContainer);
            ocrCard.addView(ocrScroll);
            root.addView(ocrCard);

            final Runnable renderOcrState = new Runnable() {
                @Override
                public void run() {
                    linesContainer.removeAllViews();
                    NativeVideoOcrResult cur = latestOcrHolder[0];
                    if (cur == null) {
                        copyAllBtn.setVisibility(View.GONE);
                        TextView loadingTv = new TextView(activity);
                        loadingTv.setText("🔍 온디바이스 AI가 영상 화면 속 한글을 빠르게 읽고 있습니다...");
                        loadingTv.setTextColor(Color.parseColor("#E2E8F0"));
                        loadingTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.0f);
                        linesContainer.addView(loadingTv);
                        return;
                    }
                    if (!cur.hasText || cur.lines.isEmpty()) {
                        copyAllBtn.setVisibility(View.GONE);
                        TextView emptyTv = new TextView(activity);
                        emptyTv.setText("이 영상 화면에서는 인식된 글자가 없습니다.");
                        emptyTv.setTextColor(Color.parseColor("#94A3B8"));
                        emptyTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.0f);
                        linesContainer.addView(emptyTv);
                        return;
                    }
                    ocrTitleTv.setText("📝 추출된 화면 한글 (" + cur.lines.size() + "구간 · 터치 시 구간 이동·복사)");
                    copyAllBtn.setVisibility(View.VISIBLE);
                    final StringBuilder copyBuf = new StringBuilder();
                    for (int idx = 0; idx < cur.lines.size(); idx++) {
                        final NativeOcrLineEntry entry = cur.lines.get(idx);
                        if (idx > 0) copyBuf.append('\n');
                        copyBuf.append(entry.text);

                        TextView rowTv = new TextView(activity);
                        rowTv.setText("[" + entry.timestamp + "]  " + entry.text);
                        rowTv.setTextColor(Color.parseColor("#F8FAFC"));
                        rowTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
                        rowTv.setPadding(dpToPx(activity, 10), dpToPx(activity, 8), dpToPx(activity, 10), dpToPx(activity, 8));
                        GradientDrawable rowBg = new GradientDrawable();
                        rowBg.setColor(Color.parseColor("#1E293B"));
                        rowBg.setCornerRadius(dpToPx(activity, 10));
                        rowTv.setBackground(rowBg);
                        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                        );
                        if (idx > 0) rowLp.topMargin = dpToPx(activity, 6);
                        rowTv.setLayoutParams(rowLp);
                        rowTv.setOnClickListener(v -> {
                            try {
                                long targetMs = Math.max(0, entry.timeSec) * 1000L;
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && mpHolder[0] != null) {
                                    mpHolder[0].seekTo(targetMs, android.media.MediaPlayer.SEEK_CLOSEST);
                                } else {
                                    videoView.seekTo((int) targetMs);
                                }
                                if (!videoView.isPlaying()) videoView.start();
                                ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                                if (cm != null) {
                                    sLastInjectedClipHash = sha256HexUtf8(entry.text);
                                    sLastInjectedClipAtMs = System.currentTimeMillis();
                                    cm.setPrimaryClip(ClipData.newPlainText("GhostiVideoOcr", entry.text));
                                    Toast.makeText(activity, "구간 이동 및 문장 복사 완료", Toast.LENGTH_SHORT).show();
                                }
                            } catch (Throwable ignored) {
                            }
                        });
                        linesContainer.addView(rowTv);
                    }
                    final String allPlain = copyBuf.toString();
                    copyAllBtn.setOnClickListener(v -> {
                        try {
                            ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                            if (cm != null && !allPlain.isEmpty()) {
                                sLastInjectedClipHash = sha256HexUtf8(allPlain);
                                sLastInjectedClipAtMs = System.currentTimeMillis();
                                cm.setPrimaryClip(ClipData.newPlainText("GhostiVideoOcrAll", allPlain));
                                Toast.makeText(activity, "추출된 한글 전체를 복사했습니다", Toast.LENGTH_SHORT).show();
                            }
                        } catch (Throwable ignored) {
                        }
                    });
                }
            };

            renderOcrState.run();
            if (latestOcrHolder[0] == null) {
                final Context appCtx = activity.getApplicationContext();
                new Thread(() -> {
                    NativeVideoOcrResult extracted = extractNativeVideoOcrInternal(appCtx, mediaId, 8);
                    latestOcrHolder[0] = extracted;
                    activity.runOnUiThread(() -> {
                        if (dialog.isShowing()) {
                            renderOcrState.run();
                        }
                    });
                }, "GhostiDialogVideoOcr").start();
            }

            dialog.setOnDismissListener(d -> {
                try {
                    videoView.stopPlayback();
                } catch (Throwable ignored) {
                }
                if (!resolvedOnce[0]) {
                    resolvedOnce[0] = true;
                    NativeVideoOcrResult fin = latestOcrHolder[0];
                    if (fin != null) {
                        JSObject ret = fin.toJSObject();
                        ret.put("closed", true);
                        call.resolve(ret);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("ok", true);
                        ret.put("closed", true);
                        ret.put("hasText", false);
                        ret.put("ocrLines", new JSArray());
                        ret.put("fullText", "");
                        call.resolve(ret);
                    }
                }
            });

            dialog.setContentView(root);
            dialog.show();
        });
    }

    // ───────────────────────── [3귀신] Android 앱 미진입 7일 클립보드(IME·텍스트 선택·공유 시트) 브릿지 ─────────────────────────
    private static volatile GhostiMobileCarePlugin sActiveInstance = null;

    @Override
    public void load() {
        super.load();
        sActiveInstance = this;
    }

    public static void notifyNativeClipboardCaptured(GhostiSharedClipboardStore.ClipEntry entry) {
        if (entry == null) return;
        GhostiMobileCarePlugin inst = sActiveInstance;
        if (inst == null) return;
        try {
            Activity act = inst.getActivity();
            if (act == null || inst.getBridge() == null || inst.getBridge().getWebView() == null) return;
            final String payloadJson = entry.toJson().toString();
            act.runOnUiThread(() -> {
                try {
                    inst.getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('ghostiNativeClipCaptured', { detail: " + payloadJson + " }));",
                        null
                    );
                } catch (Throwable ignored) {
                }
            });
        } catch (Throwable ignored) {
        }
    }

    @PluginMethod
    public void syncSharedClipboardHistory(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("count", 0);
            call.resolve(ret);
            return;
        }
        try {
            JSArray items = call.getArray("items");
            int mergedCount = GhostiSharedClipboardStore.mergeFromWebHistory(
                ctx,
                items != null ? items : new JSONArray()
            );
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("count", mergedCount);
            call.resolve(ret);
        } catch (Throwable t) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("count", 0);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void consumePendingNativeClipboardOutbound(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        if (ctx == null) {
            ret.put("ok", false);
            ret.put("items", new JSArray());
            call.resolve(ret);
            return;
        }
        try {
            JSONArray pending = GhostiSharedClipboardStore.consumePendingOutbound(ctx);
            JSArray out = new JSArray();
            for (int i = 0; i < pending.length(); i++) {
                JSONObject o = pending.optJSONObject(i);
                if (o != null) {
                    out.put(o);
                }
            }
            ret.put("ok", true);
            ret.put("items", out);
            call.resolve(ret);
        } catch (Throwable t) {
            ret.put("ok", false);
            ret.put("items", new JSArray());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getNativeClipboardImeStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        boolean enabled = false;
        boolean selected = false;
        try {
            if (ctx != null) {
                android.view.inputmethod.InputMethodManager imm =
                    (android.view.inputmethod.InputMethodManager) ctx.getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) {
                    String pkg = ctx.getPackageName();
                    for (android.view.inputmethod.InputMethodInfo info : imm.getEnabledInputMethodList()) {
                        if (info != null && pkg.equals(info.getPackageName())) {
                            enabled = true;
                            break;
                        }
                    }
                }
                String defaultIme = Settings.Secure.getString(
                    ctx.getContentResolver(),
                    Settings.Secure.DEFAULT_INPUT_METHOD
                );
                if (defaultIme != null && defaultIme.contains(ctx.getPackageName())) {
                    selected = true;
                }
            }
        } catch (Throwable ignored) {
        }
        ret.put("ok", true);
        ret.put("enabled", enabled);
        ret.put("selected", selected);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNativeClipboardImeSettings(PluginCall call) {
        Activity act = getActivity();
        Context ctx = getContext();
        String mode = call.getString("mode", "settings");
        JSObject ret = new JSObject();
        if (act == null || ctx == null) {
            ret.put("ok", false);
            call.resolve(ret);
            return;
        }
        act.runOnUiThread(() -> {
            try {
                if ("picker".equalsIgnoreCase(mode)) {
                    android.view.inputmethod.InputMethodManager imm =
                        (android.view.inputmethod.InputMethodManager) ctx.getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.showInputMethodPicker();
                    }
                } else {
                    Intent intent = new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    act.startActivity(intent);
                }
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Throwable t) {
                ret.put("ok", false);
                call.resolve(ret);
            }
        });
    }
}
