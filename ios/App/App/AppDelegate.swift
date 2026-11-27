import UIKit
import UserNotifications
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    static let pcClipCategoryIdentifier = "GHOSTI_PC_CLIP"
    static let pcClipCopyActionIdentifier = "COPY_PC_CLIP"

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        configurePcClipNotificationCategory()
        return true
    }

    private func configurePcClipNotificationCategory() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let copyAction = UNNotificationAction(
            identifier: AppDelegate.pcClipCopyActionIdentifier,
            title: "📋 복사",
            options: []
        )
        let category = UNNotificationCategory(
            identifier: AppDelegate.pcClipCategoryIdentifier,
            actions: [copyAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        center.setNotificationCategories([category])
    }

    static func scheduleLocalPcClipNotification(pushId: String, plainText: String, senderName: String) {
        let trimmed = plainText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if !pushId.isEmpty && !GhostKeySharedClipboardStore.markPushIdSeen(pushId) {
            // 이미 처리된 pushId라도 markPushIdSeen 이전에 선마킹된 경우 방어용
        }
        let content = UNMutableNotificationContent()
        let cleanSender = senderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "내 PC" : senderName
        content.title = "📱 \(cleanSender)에서 보낸 클립보드"
        let preview = trimmed.replacingOccurrences(of: "\n", with: " ")
        content.body = preview.count > 96 ? String(preview.prefix(96)) + "…" : preview
        content.sound = .default
        content.categoryIdentifier = AppDelegate.pcClipCategoryIdentifier
        content.userInfo = [
            "ghosti_clip_text": trimmed,
            "ghosti_push_id": pushId
        ]

        let identifier = pushId.isEmpty ? "ghosti_pc_clip_\(Int(Date().timeIntervalSince1970 * 1000))" : pushId
        let req = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    // 포그라운드 상태에서도 PC [📱 폰으로 보내기] 알림 배너가 상단에 즉시 표시되도록 보장
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([.alert, .sound])
        }
    }

    // 알림의 [📋 복사] 버튼 1탭 또는 알림 배너 터치 시 즉시 아이폰 클립보드에 복사
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let clipText = userInfo["ghosti_clip_text"] as? String, !clipText.isEmpty {
            DispatchQueue.main.async {
                UIPasteboard.general.string = clipText
                UserDefaults.standard.set(clipText, forKey: "ghosti_pending_push_copy_text")
                completionHandler()
            }
            return
        }
        completionHandler()
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
