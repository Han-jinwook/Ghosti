package app.sundreamer.ghosti;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

/**
 * [Ghosti 3귀신] PC ➔ 폰 선택 전송 푸시 알림의 [📋 복사] 액션 1탭 전용 0ms 투명 액티비티
 * - Android 10+ OS 정책상 백그라운드 BroadcastReceiver는 ClipboardManager.setPrimaryClip이 무음 차단되므로,
 *   1프레임 투명 포커스 액티비티로 즉시 폰 클립보드에 복사 후 본체 앱을 전혀 열지 않고 종료합니다.
 */
public class GhostiNotificationCopyActivity extends Activity {
    public static final String EXTRA_CLIP_TEXT = "ghosti_extra_clip_text";
    public static final String EXTRA_NOTIFICATION_ID = "ghosti_extra_notif_id";

    private boolean copiedDone = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        overridePendingTransition(0, 0);
        super.onCreate(savedInstanceState);
        if (performCopyNow()) {
            finishQuietly();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && !copiedDone) {
            performCopyNow();
            finishQuietly();
        }
    }

    private boolean performCopyNow() {
        if (copiedDone) return true;
        Intent intent = getIntent();
        if (intent == null) return true;
        int notifId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);
        if (notifId >= 0) {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel(notifId);
            } catch (Throwable ignored) {
            }
        }
        String text = intent.getStringExtra(EXTRA_CLIP_TEXT);
        if (text == null || text.trim().isEmpty()) {
            copiedDone = true;
            return true;
        }
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) {
                cm.setPrimaryClip(ClipData.newPlainText("귀신같이", text));
                copiedDone = true;
                Toast.makeText(getApplicationContext(), "📋 클립보드에 복사되었습니다. 바로 붙여넣기 하세요!", Toast.LENGTH_SHORT).show();
                return true;
            }
        } catch (Throwable ignored) {
        }
        return false;
    }

    private void finishQuietly() {
        finish();
        overridePendingTransition(0, 0);
    }
}
