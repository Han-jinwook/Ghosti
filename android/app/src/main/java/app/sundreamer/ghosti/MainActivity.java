package app.sundreamer.ghosti;

import android.content.Intent;
import android.content.IntentSender;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public interface IntentSenderResultCallback {
        void onResult(int resultCode, Intent data);
    }

    private static final int REQ_MEDIASTORE_TRASH = 51991;
    private IntentSenderResultCallback pendingTrashCallback = null;

    public void launchMediaStoreIntentSender(IntentSender sender, IntentSenderResultCallback callback) throws IntentSender.SendIntentException {
        this.pendingTrashCallback = callback;
        startIntentSenderForResult(sender, REQ_MEDIASTORE_TRASH, null, 0, 0, 0);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_MEDIASTORE_TRASH) {
            IntentSenderResultCallback cb = this.pendingTrashCallback;
            this.pendingTrashCallback = null;
            if (cb != null) {
                cb.onResult(resultCode, data);
                return;
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        final Thread.UncaughtExceptionHandler prevHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            String msg = throwable != null && throwable.getMessage() != null ? throwable.getMessage() : "";
            if (throwable instanceof IllegalStateException
                && (msg.contains("FirebaseApp") || msg.contains("FirebaseInitProvider"))) {
                Log.w("GhostiMainActivity", "Suppressed uninitialized FirebaseApp exception on thread " + thread.getName() + ": " + msg);
                return;
            }
            if (prevHandler != null) {
                prevHandler.uncaughtException(thread, throwable);
            }
        });
        registerPlugin(GhostiMobileCarePlugin.class);
        super.onCreate(savedInstanceState);

        // [Android 15/16 Edge-to-Edge Safe Area & 상태바 시계/배터리 가시성 보장]:
        // 기본 웜 라이트 배경(#F8F7F4)과 어두운 상태바 아이콘(LightStatusBars=true)을 일치시켜 검정 배경에 시계·배터리가 묻히지 않게 보장
        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.parseColor("#F8F7F4"));
            window.setNavigationBarColor(Color.parseColor("#F8F7F4"));
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(true);
                controller.setAppearanceLightNavigationBars(true);
            }
        }
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#F8F7F4"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentView);
        }
    }
}
