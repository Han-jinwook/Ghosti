package app.sundreamer.ghosti;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

/**
 * [Ghosti 3귀신] 포그라운드 서비스 권한(FOREGROUND_SERVICE_*) 없이 순정 JobScheduler로
 * 캐시 프리저/프로세스 회수 이후에도 PC [📱 폰으로 보내기] 인박스 수신을 자가 복구하는 경량 JobService
 */
public class GhostiPushKeepAliveJobService extends JobService {
    private static final int JOB_ID_PUSH_KEEPALIVE = 51993;

    public static void scheduleNext(Context ctx, long minLatencyMs) {
        if (ctx == null) return;
        try {
            Context appCtx = ctx.getApplicationContext();
            SharedPreferences authPrefs = appCtx.getSharedPreferences("ghosti_native_clip_auth_v1", Context.MODE_PRIVATE);
            String email = authPrefs.getString("email", "");
            String token = authPrefs.getString("hubToken", "");
            JobScheduler js = (JobScheduler) appCtx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js == null) return;
            if (email == null || email.isEmpty() || token == null || token.isEmpty()) {
                js.cancel(JOB_ID_PUSH_KEEPALIVE);
                return;
            }
            long safeLatency = Math.max(5_000L, minLatencyMs);
            ComponentName comp = new ComponentName(appCtx, GhostiPushKeepAliveJobService.class);
            JobInfo info = new JobInfo.Builder(JOB_ID_PUSH_KEEPALIVE, comp)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setMinimumLatency(safeLatency)
                .setOverrideDeadline(safeLatency + 45_000L)
                .setPersisted(true)
                .build();
            js.schedule(info);
        } catch (Throwable ignored) {
        }
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        final Context appCtx = getApplicationContext();
        GhostiNativeClipboardSync.ensurePhonePushWatcherAlive(appCtx);
        new Thread(() -> {
            try {
                GhostiNativeClipboardSync.checkPhonePushInboxSync(appCtx);
            } catch (Throwable ignored) {
            } finally {
                scheduleNext(appCtx, 20_000L);
                try {
                    jobFinished(params, false);
                } catch (Throwable ignored) {
                }
            }
        }, "ghosti-push-job-pull").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        scheduleNext(getApplicationContext(), 15_000L);
        return true;
    }
}
