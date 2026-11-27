package app.sundreamer.ghosti;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * [Ghosti 3귀신 · Android FCM 정식 백그라운드·앱종료 푸시 수신기]
 * - PC [📱 폰으로 보내기] 시 FCM High-Priority Data Message를 백그라운드·화면꺼짐·앱완전종료 상태에서도 0.5초 내 수신
 * - 기기 내부 SharedPreferences E2EE 키로 즉시 복호화 후 [📋 복사] 1탭 알림 표시 (평문 서버 미노출)
 * - 그 외 패밀리(센스톡·루미노트·썬드리머 등) 푸시는 Capacitor MessagingService로 그대로 전달
 */
public class GhostiFirebaseMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null && "GHOSTI_PC_CLIP".equals(data.get("type"))) {
            String pushId = data.get("pushId");
            String cipherB64 = data.get("cipherB64");
            String ivB64 = data.get("ivB64");
            String senderName = data.get("senderName");
            GhostiNativeClipboardSync.handleIncomingFcmClipPush(
                getApplicationContext(),
                pushId,
                cipherB64,
                ivB64,
                senderName
            );
            return;
        }
        super.onMessageReceived(remoteMessage);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        GhostiNativeClipboardSync.registerFcmTokenFromNative(getApplicationContext(), token);
    }
}
