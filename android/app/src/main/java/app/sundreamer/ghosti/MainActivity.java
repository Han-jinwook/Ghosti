package app.sundreamer.ghosti;

import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

        // [Android 15/16 Edge-to-Edge Safe Area 보호]: 상단 상태바(시계·배터리) 및 하단 내비게이션바 침범 원천 차단
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#070B11"));
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
