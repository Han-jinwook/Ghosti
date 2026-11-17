package app.sundreamer.ghosti;

import android.os.Bundle;
import android.util.Log;
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
    }
}
