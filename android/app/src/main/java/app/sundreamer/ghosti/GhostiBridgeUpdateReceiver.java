package app.sundreamer.ghosti;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * [Ghosti 3귀신] Play 스토어 업데이트(MY_PACKAGE_REPLACED) 및 기기 재부팅(BOOT_COMPLETED) 직후
 * 사용자가 귀신같이 앱을 직접 열기 전에도 PC [📱 폰으로 보내기] 선택 푸시 워처·JobService를 즉시 기동합니다.
 */
public class GhostiBridgeUpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            && !Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            return;
        }
        final Context appCtx = context.getApplicationContext();
        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                GhostiNativeClipboardSync.ensurePcClipPushChannel(appCtx);
                GhostiNativeClipboardSync.ensurePhonePushWatcherAlive(appCtx);
                GhostiNativeClipboardSync.checkPhonePushInboxNow(appCtx);
                GhostiPushKeepAliveJobService.scheduleNext(appCtx, 15_000L);
            } catch (Throwable ignored) {
            } finally {
                try {
                    pendingResult.finish();
                } catch (Throwable ignored) {
                }
            }
        }, "ghosti-bridge-update-wake").start();
    }
}
