import UIKit
import UserNotifications
import Capacitor

/// Capacitor NotificationRouter가 delegate를 교체하더라도 GHOSTI_PC_CLIP 알림의
/// [📋 복사] 버튼 등록·전면 배너 표시·1탭 클립보드 복사가 100% 작동하도록 보장하는 위임 프록시
final class GhostiPcClipNotificationProxy: NSObject, UNUserNotificationCenterDelegate {
    static let shared = GhostiPcClipNotificationProxy()
    weak var fallbackDelegate: UNUserNotificationCenterDelegate?

    func installIfNeeded() {
        let center = UNUserNotificationCenter.current()
        if let cur = center.delegate, !(cur is GhostiPcClipNotificationProxy) {
            fallbackDelegate = cur
        }
        if !(center.delegate is GhostiPcClipNotificationProxy) {
            center.delegate = self
        }
        ensureCategoryMerged(completion: nil)
    }

    func ensureCategoryMerged(completion: (() -> Void)?) {
        let center = UNUserNotificationCenter.current()
        let copyAction = UNNotificationAction(
            identifier: AppDelegate.pcClipCopyActionIdentifier,
            title: "📋 복사",
            options: []
        )
        let clipCat = UNNotificationCategory(
            identifier: AppDelegate.pcClipCategoryIdentifier,
            actions: [copyAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        center.getNotificationCategories { existing in
            var updated = Set(existing.filter { $0.identifier != AppDelegate.pcClipCategoryIdentifier })
            updated.insert(clipCat)
            center.setNotificationCategories(updated)
            completion?()
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if notification.request.content.categoryIdentifier == AppDelegate.pcClipCategoryIdentifier {
            if #available(iOS 14.0, *) {
                completionHandler([.banner, .list, .sound])
            } else {
                completionHandler([.alert, .sound])
            }
            return
        }
        if let fb = fallbackDelegate,
           fb.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            fb.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
            return
        }
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([.alert, .sound])
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let clipText = userInfo["ghosti_clip_text"] as? String, !clipText.isEmpty {
            let actId = response.actionIdentifier
            if actId == AppDelegate.pcClipCopyActionIdentifier || actId == UNNotificationDefaultActionIdentifier {
                DispatchQueue.main.async {
                    UIPasteboard.general.string = clipText
                    UserDefaults.standard.set(clipText, forKey: "ghosti_pending_push_copy_text")
                    if actId == UNNotificationDefaultActionIdentifier {
                        AppDelegate.showFloatingCopiedToast()
                    }
                    completionHandler()
                }
                return
            }
            completionHandler()
            return
        }
        if let fb = fallbackDelegate,
           fb.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            fb.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
            return
        }
        completionHandler()
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    static let pcClipCategoryIdentifier = "GHOSTI_PC_CLIP"
    static let pcClipCopyActionIdentifier = "COPY_PC_CLIP"

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        GhostiPcClipNotificationProxy.shared.installIfNeeded()
        return true
    }

    static func ensureNotificationPermissionIfNeeded() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            if settings.authorizationStatus == .notDetermined {
                center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
                    GhostiPcClipNotificationProxy.shared.installIfNeeded()
                }
            } else {
                GhostiPcClipNotificationProxy.shared.installIfNeeded()
            }
        }
    }

    static func scheduleLocalPcClipNotification(pushId: String, plainText: String, senderName: String) {
        let trimmed = plainText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if !pushId.isEmpty && !GhostKeySharedClipboardStore.markPushIdSeen(pushId) {
            return
        }

        GhostiPcClipNotificationProxy.shared.installIfNeeded()
        GhostiPcClipNotificationProxy.shared.ensureCategoryMerged {
            let content = UNMutableNotificationContent()
            let cleanSender = senderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "내 PC" : senderName
            content.title = "📋 \(cleanSender)에서 보낸 클립보드"
            content.subtitle = "한 번 터치하거나 아래로 당겨 [📋 복사]"
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
    }

    static func showFloatingCopiedToast() {
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let keyWin = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first else {
            return
        }
        let pill = UILabel()
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.text = "  ✅ 클립보드에 복사되었습니다! 바로 붙여넣으세요  "
        pill.font = UIFont.systemFont(ofSize: 13.5, weight: .semibold)
        pill.textColor = .white
        pill.backgroundColor = UIColor(red: 13.0 / 255.0, green: 148.0 / 255.0, blue: 136.0 / 255.0, alpha: 0.96)
        pill.textAlignment = .center
        pill.layer.cornerRadius = 18
        pill.layer.masksToBounds = true
        keyWin.addSubview(pill)
        NSLayoutConstraint.activate([
            pill.centerXAnchor.constraint(equalTo: keyWin.centerXAnchor),
            pill.topAnchor.constraint(equalTo: keyWin.safeAreaLayoutGuide.topAnchor, constant: 12),
            pill.heightAnchor.constraint(equalToConstant: 36)
        ])
        UIView.animate(withDuration: 0.25, delay: 1.8, options: .curveEaseOut, animations: {
            pill.alpha = 0
        }, completion: { _ in
            pill.removeFromSuperview()
        })
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
