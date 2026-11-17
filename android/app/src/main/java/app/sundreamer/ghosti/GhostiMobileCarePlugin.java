package app.sundreamer.ghosti;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "GhostiMobileCare")
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
}
