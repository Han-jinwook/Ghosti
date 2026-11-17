package app.sundreamer.ghosti;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    @PluginMethod
    public void scanInstalledBloatCleaners(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        JSArray detected = new JSArray();

        for (String pkg : TARGET_BLOAT_PACKAGES) {
            try {
                PackageInfo info = pm.getPackageInfo(pkg, 0);
                if (info != null) {
                    ApplicationInfo appInfo = info.applicationInfo;
                    String appLabel = appInfo != null ? String.valueOf(pm.getApplicationLabel(appInfo)) : pkg;
                    boolean isCleanX = pkg.contains("cleanx");
                    JSObject item = new JSObject();
                    item.put("packageName", pkg);
                    item.put("appName", appLabel);
                    item.put("versionName", info.versionName != null ? info.versionName : "");
                    item.put("isSubscriptionTrap", isCleanX || pkg.contains("guru") || pkg.contains("swipe") || pkg.contains("ai.cleaner"));
                    item.put(
                        "riskSummaryKo",
                        isCleanX
                            ? "🚨 3일 무료체험 후 주 13,000원(월 52,000원) 자동결제 유도 및 Google 계정 데이터 접근 권한 위험"
                            : "⚠️ 불필요한 광고 팝업·백그라운드 배터리 소모 및 유료 구독 유도 위험 클리너"
                    );
                    detected.put(item);
                }
            } catch (PackageManager.NameNotFoundException ignored) {
                // 미설치 패키지 무시
            } catch (Exception ignored) {
            }
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("scannedCount", TARGET_BLOAT_PACKAGES.length);
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
}
