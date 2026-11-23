package app.sundreamer.ghosti;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

/**
 * [Ghosti 3귀신] Android 앱 미진입 텍스트 선택 툴바(ACTION_PROCESS_TEXT) & 공유 시트(ACTION_SEND) 직결 액티비티
 * - 투명 무화면(NoDisplay/Translucent)으로 동작해 본체 앱으로 화면 전환 없이 0.1초 만에
 *   7일 클립보드 스택 누적 + PC E2EE 전송 대기열에 적재 후 즉시 종료합니다.
 */
public class GhostiQuickClipActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleQuickClipIntent(getIntent());
        finish();
    }

    private void handleQuickClipIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        CharSequence captured = null;
        if (Intent.ACTION_PROCESS_TEXT.equals(action)) {
            captured = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
        } else if (Intent.ACTION_SEND.equals(action)) {
            captured = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        }
        String text = captured != null ? captured.toString().trim() : "";
        if (text.isEmpty()) {
            Toast.makeText(this, "전송할 텍스트가 비어 있습니다.", Toast.LENGTH_SHORT).show();
            return;
        }
        GhostiSharedClipboardStore.pushLocalCapturedClip(
            this,
            text,
            GhostiSharedClipboardStore.defaultDeviceLabel() + " (바로담기)"
        );
        Toast.makeText(this, "귀신 7일 클립보드에 저장·전송했습니다.", Toast.LENGTH_SHORT).show();
    }
}
