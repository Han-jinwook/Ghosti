import UIKit
import UserNotifications
import Capacitor

/// Capacitor 공식 NotificationRouter.localNotificationHandler와 직접 결합하여
/// 앱이 전면(Foreground)이나 백그라운드 어느 상태에 있든 GHOSTI_PC_CLIP 로컬 알림 배너·사운드·[📋 복사] 액션을 100% 보장
@objc(GhostiLocalClipNotificationHandler)
public final class GhostiLocalClipNotificationHandler: NSObject, NotificationHandlerProtocol {
    public static let shared = GhostiLocalClipNotificationHandler()

    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        if #available(iOS 14.0, *) {
            return [.banner, .list, .sound]
        } else {
            return [.alert, .sound]
        }
    }

    private static func resolveClipTextFromUserInfo(_ userInfo: [AnyHashable: Any]) -> String? {
        if let direct = userInfo["ghosti_clip_text"] as? String, !direct.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return direct.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let cB64 = userInfo["cipherB64"] as? String,
           let ivB64 = userInfo["ivB64"] as? String,
           !cB64.isEmpty, !ivB64.isEmpty,
           let decrypted = GhostKeySharedClipboardStore.decryptClipText(cipherB64: cB64, ivB64: ivB64),
           !decrypted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return decrypted.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return nil
    }

    public func didReceive(response: UNNotificationResponse) {
        let userInfo = response.notification.request.content.userInfo
        let isPcClip = response.notification.request.content.categoryIdentifier == AppDelegate.pcClipCategoryIdentifier
            || (userInfo["type"] as? String) == "GHOSTI_PC_CLIP"
            || userInfo["ghosti_clip_text"] != nil
        guard isPcClip else { return }

        let actId = response.actionIdentifier
        guard actId == AppDelegate.pcClipCopyActionIdentifier || actId == UNNotificationDefaultActionIdentifier else {
            return
        }
        if let pushId = userInfo["pushId"] as? String, !pushId.isEmpty {
            _ = GhostKeySharedClipboardStore.markPushIdSeen(pushId)
        }
        if let clipText = Self.resolveClipTextFromUserInfo(userInfo) {
            DispatchQueue.main.async {
                UIPasteboard.general.string = clipText
                UserDefaults.standard.set(clipText, forKey: "ghosti_pending_push_copy_text")
                if actId == UNNotificationDefaultActionIdentifier {
                    AppDelegate.showFloatingCopiedToast()
                }
            }
            return
        }
        // 대용량(>2.8KB) APNs 페이로드인 경우 서버 인박스에서 즉시 복호화 후 복사
        GhostKeySharedClipboardStore.pullPhonePushInboxOnce { _, plain, _ in
            let clean = plain.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !clean.isEmpty else { return }
            DispatchQueue.main.async {
                UIPasteboard.general.string = clean
                UserDefaults.standard.set(clean, forKey: "ghosti_pending_push_copy_text")
                if actId == UNNotificationDefaultActionIdentifier {
                    AppDelegate.showFloatingCopiedToast()
                }
            }
        }
    }
}

/// Capacitor NotificationRouter가 교체되기 전·후 어떤 시점에도 GHOSTI_PC_CLIP 알림을 보호하는 메인 스레드 위임 프록시
final class GhostiPcClipNotificationProxy: NSObject, UNUserNotificationCenterDelegate {
    static let shared = GhostiPcClipNotificationProxy()
    weak var fallbackDelegate: UNUserNotificationCenterDelegate?
    private var categoryRegistered = false

    func installOnMain() {
        let work = {
            let center = UNUserNotificationCenter.current()
            if let cur = center.delegate, !(cur is GhostiPcClipNotificationProxy) {
                self.fallbackDelegate = cur
            }
            if !(center.delegate is GhostiPcClipNotificationProxy) {
                center.delegate = self
            }
            self.registerPcClipCategorySyncIfNeeded()
        }
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    func registerPcClipCategorySyncIfNeeded() {
        guard !categoryRegistered else { return }
        categoryRegistered = true
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
        center.setNotificationCategories([clipCat])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if notification.request.content.categoryIdentifier == AppDelegate.pcClipCategoryIdentifier
            || notification.request.content.userInfo["ghosti_clip_text"] != nil {
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
        let isPcClip = response.notification.request.content.categoryIdentifier == AppDelegate.pcClipCategoryIdentifier
            || (userInfo["type"] as? String) == "GHOSTI_PC_CLIP"
            || userInfo["ghosti_clip_text"] != nil
        if isPcClip {
            let actId = response.actionIdentifier
            if actId == AppDelegate.pcClipCopyActionIdentifier || actId == UNNotificationDefaultActionIdentifier {
                if let pushId = userInfo["pushId"] as? String, !pushId.isEmpty {
                    _ = GhostKeySharedClipboardStore.markPushIdSeen(pushId)
                }
                var resolvedText = (userInfo["ghosti_clip_text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if resolvedText.isEmpty,
                   let cB64 = userInfo["cipherB64"] as? String,
                   let ivB64 = userInfo["ivB64"] as? String,
                   let dec = GhostKeySharedClipboardStore.decryptClipText(cipherB64: cB64, ivB64: ivB64) {
                    resolvedText = dec.trimmingCharacters(in: .whitespacesAndNewlines)
                }
                if !resolvedText.isEmpty {
                    DispatchQueue.main.async {
                        UIPasteboard.general.string = resolvedText
                        UserDefaults.standard.set(resolvedText, forKey: "ghosti_pending_push_copy_text")
                        if actId == UNNotificationDefaultActionIdentifier {
                            AppDelegate.showFloatingCopiedToast()
                        }
                        completionHandler()
                    }
                    return
                }
                GhostKeySharedClipboardStore.pullPhonePushInboxOnce { _, plain, _ in
                    let clean = plain.trimmingCharacters(in: .whitespacesAndNewlines)
                    DispatchQueue.main.async {
                        if !clean.isEmpty {
                            UIPasteboard.general.string = clean
                            UserDefaults.standard.set(clean, forKey: "ghosti_pending_push_copy_text")
                            if actId == UNNotificationDefaultActionIdentifier {
                                AppDelegate.showFloatingCopiedToast()
                            }
                        }
                        completionHandler()
                    }
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
        GhostiPcClipNotificationProxy.shared.installOnMain()
        return true
    }

    static func ensureNotificationPermissionIfNeeded() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            if settings.authorizationStatus == .notDetermined {
                center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
                    GhostiPcClipNotificationProxy.shared.installOnMain()
                }
            } else {
                GhostiPcClipNotificationProxy.shared.installOnMain()
            }
        }
    }

    static func scheduleLocalPcClipNotification(pushId: String, plainText: String, senderName: String) {
        let trimmed = plainText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if !pushId.isEmpty && !GhostKeySharedClipboardStore.markPushIdSeen(pushId) {
            return
        }

        DispatchQueue.main.async {
            GhostiPcClipNotificationProxy.shared.installOnMain()
            let content = UNMutableNotificationContent()
            let cleanSender = senderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "내 PC" : senderName
            content.title = "📋 \(cleanSender)에서 보낸 클립보드"
            content.subtitle = "아래로 당겨 [📋 복사] 또는 배너 한 번 터치"
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
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        if let pushId = userInfo["pushId"] as? String, !pushId.isEmpty {
            _ = GhostKeySharedClipboardStore.markPushIdSeen(pushId)
        }
        completionHandler(.newData)
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
