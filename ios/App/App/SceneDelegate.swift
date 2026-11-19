import UIKit
import WebKit
import Capacitor
import Photos
import PhotosUI
import AVFoundation

@objc(GhostiBridgeViewController)
class GhostiBridgeViewController: CAPBridgeViewController {
    override open var preferredStatusBarStyle: UIStatusBarStyle {
        return .darkContent
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GhostiMobileCarePlugin())
        view.backgroundColor = UIColor.white
        webView?.isOpaque = true
        webView?.backgroundColor = UIColor.white
        webView?.scrollView.backgroundColor = UIColor.white
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleIosKeyboardFrameChange(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleIosKeyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleIosKeyboardFrameChange(_ notification: Notification) {
        guard isViewLoaded,
              let userInfo = notification.userInfo,
              let endVal = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else {
            return
        }
        let kbEndInView = view.convert(endVal.cgRectValue, from: nil)
        let overlap = max(0, Int(ceil(view.bounds.height - kbEndInView.origin.y)))
        let isOpen = overlap > 60
        let js = """
        (function(){
          var r = document.documentElement;
          if (r) r.style.setProperty('--ghosti-kb-inset', '\(overlap)px');
          window.dispatchEvent(new CustomEvent('ghostiKeyboardState', { detail: { open: \(isOpen ? "true" : "false"), height: \(overlap), platform: 'ios' } }));
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc private func handleIosKeyboardWillHide(_ notification: Notification) {
        let js = """
        (function(){
          var r = document.documentElement;
          if (r) r.style.setProperty('--ghosti-kb-inset', '0px');
          window.dispatchEvent(new CustomEvent('ghostiKeyboardState', { detail: { open: false, height: 0, platform: 'ios' } }));
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    override open func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        syncHardwareSafeAreaCssVars()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.syncHardwareSafeAreaCssVars()
        }
    }

    override open func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        syncHardwareSafeAreaCssVars()
    }

    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        syncHardwareSafeAreaCssVars()
    }

    override open func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { [weak self] _ in
            self?.syncHardwareSafeAreaCssVars()
        }, completion: { [weak self] _ in
            self?.syncHardwareSafeAreaCssVars()
        })
    }

    private func syncHardwareSafeAreaCssVars() {
        guard isViewLoaded else { return }
        let insets = view.safeAreaInsets
        let top = Int(ceil(insets.top))
        let bottom = Int(ceil(insets.bottom))
        let left = Int(ceil(insets.left))
        let right = Int(ceil(insets.right))
        let js = """
        (function(){
          var r = document.documentElement;
          if (!r) return;
          r.style.setProperty('--ghosti-safe-top', '\(top)px');
          r.style.setProperty('--ghosti-safe-bottom', '\(bottom)px');
          r.style.setProperty('--ghosti-safe-left', '\(left)px');
          r.style.setProperty('--ghosti-safe-right', '\(right)px');
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}

@objc(GhostiMobileCarePlugin)
public class GhostiMobileCarePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GhostiMobileCarePlugin"
    public let jsName = "GhostiMobileCare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scanDeviceGalleryMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolveVideoPlaybackUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestSystemPhotoTrash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppPermissionSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanInstalledBloatCleaners", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingDeepLink", returnType: CAPPluginReturnPromise)
    ]

    private func hasPhotoAccess(_ status: PHAuthorizationStatus) -> Bool {
        if #available(iOS 14, *) {
            return status == .authorized || status == .limited
        }
        return status == .authorized
    }

    @objc func scanInstalledBloatCleaners(_ call: CAPPluginCall) {
        call.resolve([
            "ok": true,
            "scannedCount": 0,
            "detected": []
        ])
    }

    @objc func consumePendingDeepLink(_ call: CAPPluginCall) {
        let key = "ghosti_pending_deep_link_url"
        let urlStr = UserDefaults.standard.string(forKey: key) ?? ""
        if !urlStr.isEmpty {
            UserDefaults.standard.removeObject(forKey: key)
        }
        call.resolve([
            "ok": true,
            "deepLinkUrl": urlStr,
            "source": urlStr.isEmpty ? "none" : "url_scheme"
        ])
    }

    @objc func openAppPermissionSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            call.resolve(["ok": true])
        }
    }

    @objc func scanDeviceGalleryMedia(_ call: CAPPluginCall) {
        let offset = max(0, call.getInt("offset") ?? 0)
        let limit = min(120, max(1, call.getInt("limit") ?? 60))
        let thumbMaxDim = min(640, max(240, call.getInt("thumbMaxDim") ?? 448))
        let includeVideos = call.getBool("includeVideos") ?? (offset == 0)
        let promptPerm = call.getBool("promptPermission") ?? true
        let forceExpandSelected = call.getBool("forceExpandSelected") ?? false

        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if #available(iOS 14, *), status == .limited, forceExpandSelected {
            DispatchQueue.main.async {
                if let vc = self.bridge?.viewController {
                    PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: vc)
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                    self.runPhotoKitScan(call: call, offset: offset, limit: limit, thumbMaxDim: thumbMaxDim, includeVideos: includeVideos, isLimited: true)
                }
            }
            return
        }
        if hasPhotoAccess(status) {
            let isLim: Bool = {
                if #available(iOS 14, *) { return status == .limited }
                return false
            }()
            runPhotoKitScan(call: call, offset: offset, limit: limit, thumbMaxDim: thumbMaxDim, includeVideos: includeVideos, isLimited: isLim)
            return
        }

        if status == .notDetermined && promptPerm {
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
                if self.hasPhotoAccess(newStatus) {
                    let isLim: Bool = {
                        if #available(iOS 14, *) { return newStatus == .limited }
                        return false
                    }()
                    self.runPhotoKitScan(call: call, offset: offset, limit: limit, thumbMaxDim: thumbMaxDim, includeVideos: includeVideos, isLimited: isLim)
                } else {
                    call.resolve([
                        "ok": false,
                        "permissionGranted": false,
                        "limitedAccess": false,
                        "videoPermissionGranted": false,
                        "photos": [],
                        "videos": [],
                        "totalPhotoCount": 0
                    ])
                }
            }
            return
        }

        call.resolve([
            "ok": false,
            "permissionGranted": false,
            "limitedAccess": false,
            "videoPermissionGranted": false,
            "photos": [],
            "videos": [],
            "totalPhotoCount": 0
        ])
    }

    private func runPhotoKitScan(call: CAPPluginCall, offset: Int, limit: Int, thumbMaxDim: Int, includeVideos: Bool, isLimited: Bool = false) {
        DispatchQueue.global(qos: .userInitiated).async {
            let fetchOpts = PHFetchOptions()
            fetchOpts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]

            let assets = PHAsset.fetchAssets(with: .image, options: fetchOpts)
            let totalPhotoCount = assets.count
            let endIdx = min(totalPhotoCount, offset + limit)

            let imgManager = PHImageManager.default()
            let reqOpts = PHImageRequestOptions()
            reqOpts.isSynchronous = true
            reqOpts.deliveryMode = .highQualityFormat
            reqOpts.resizeMode = .fast
            reqOpts.isNetworkAccessAllowed = true

            var photosList: [[String: Any]] = []
            if offset < endIdx {
                for idx in offset..<endIdx {
                    autoreleasepool {
                        let asset = assets.object(at: idx)
                        var thumbDataUrl = ""
                        let targetSize = CGSize(width: CGFloat(thumbMaxDim), height: CGFloat(thumbMaxDim))
                        imgManager.requestImage(
                            for: asset,
                            targetSize: targetSize,
                            contentMode: .aspectFit,
                            options: reqOpts
                        ) { uiImg, _ in
                            if let img = uiImg, let jpeg = img.jpegData(compressionQuality: 0.76) {
                                thumbDataUrl = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                            }
                        }

                        if thumbDataUrl.isEmpty {
                            return
                        }

                        let fileName = PHAssetResource.assetResources(for: asset).first?.originalFilename ?? "IMG_\(idx + 1).jpg"
                        let estSize = max(250_000, (asset.pixelWidth * asset.pixelHeight) / 4)
                        let createdDate = asset.creationDate ?? asset.modificationDate ?? Date()
                        let mtimeMs = Int64(createdDate.timeIntervalSince1970 * 1000.0)
                        let isScreen = asset.mediaSubtypes.contains(.photoScreenshot)

                        photosList.append([
                            "id": asset.localIdentifier,
                            "name": fileName,
                            "size": estSize,
                            "mtimeMs": mtimeMs,
                            "width": asset.pixelWidth,
                            "height": asset.pixelHeight,
                            "bucket": isScreen ? "Screenshots" : "iPhone 사진첩",
                            "isScreenshot": isScreen,
                            "thumbDataUrl": thumbDataUrl
                        ])
                    }
                }
            }

            var videosList: [[String: Any]] = []
            if includeVideos {
                let vidAssets = PHAsset.fetchAssets(with: .video, options: fetchOpts)
                let vEnd = min(vidAssets.count, 40)
                for vIdx in 0..<vEnd {
                    autoreleasepool {
                        let vAsset = vidAssets.object(at: vIdx)
                        var vThumbUrl = ""
                        imgManager.requestImage(
                            for: vAsset,
                            targetSize: CGSize(width: 480, height: 270),
                            contentMode: .aspectFit,
                            options: reqOpts
                        ) { uiImg, _ in
                            if let img = uiImg, let jpeg = img.jpegData(compressionQuality: 0.74) {
                                vThumbUrl = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                            }
                        }
                        let vName = PHAssetResource.assetResources(for: vAsset).first?.originalFilename ?? "VID_\(vIdx + 1).mp4"
                        let vEstSize = max(1_500_000, Int(vAsset.duration * 650_000.0))
                        let vCreated = vAsset.creationDate ?? vAsset.modificationDate ?? Date()
                        let vMtimeMs = Int64(vCreated.timeIntervalSince1970 * 1000.0)

                        videosList.append([
                            "id": "mobile_vid_" + vAsset.localIdentifier,
                            "name": vName,
                            "size": vEstSize,
                            "durationSec": max(1, Int(round(vAsset.duration))),
                            "mtimeMs": vMtimeMs,
                            "bucket": "iPhone 동영상",
                            "thumbDataUrl": vThumbUrl
                        ])
                    }
                }
            }

            call.resolve([
                "ok": true,
                "permissionGranted": true,
                "limitedAccess": isLimited,
                "videoPermissionGranted": true,
                "offset": offset,
                "totalPhotoCount": totalPhotoCount,
                "photos": photosList,
                "videos": videosList
            ])
        }
    }

    @objc func resolveVideoPlaybackUrl(_ call: CAPPluginCall) {
        let rawId = call.getString("id") ?? ""
        let localId = rawId.hasPrefix("mobile_vid_")
            ? String(rawId.dropFirst("mobile_vid_".count))
            : rawId
        if localId.isEmpty {
            call.resolve(["ok": false, "fileUrl": ""])
            return
        }

        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
        guard let asset = fetched.firstObject else {
            call.resolve(["ok": false, "fileUrl": ""])
            return
        }

        let safeStem = localId
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        let fm = FileManager.default
        let tmpDir = fm.temporaryDirectory

        for ext in ["mp4", "mov", "m4v"] {
            let existing = tmpDir.appendingPathComponent("ghosti_vid_\(safeStem).\(ext)")
            if fm.fileExists(atPath: existing.path) {
                call.resolve(["ok": true, "fileUrl": existing.absoluteString])
                return
            }
        }

        let vOpts = PHVideoRequestOptions()
        vOpts.isNetworkAccessAllowed = true
        vOpts.deliveryMode = .highQualityFormat

        PHImageManager.default().requestAVAsset(forVideo: asset, options: vOpts) { avAsset, _, _ in
            if let urlAsset = avAsset as? AVURLAsset {
                let srcUrl = urlAsset.url
                let ext = srcUrl.pathExtension.isEmpty ? "mov" : srcUrl.pathExtension.lowercased()
                let dstUrl = tmpDir.appendingPathComponent("ghosti_vid_\(safeStem).\(ext)")
                if !fm.fileExists(atPath: dstUrl.path) {
                    do {
                        try fm.linkItem(at: srcUrl, to: dstUrl)
                    } catch {
                        do {
                            try fm.copyItem(at: srcUrl, to: dstUrl)
                        } catch {
                            call.resolve(["ok": false, "fileUrl": ""])
                            return
                        }
                    }
                }
                call.resolve(["ok": true, "fileUrl": dstUrl.absoluteString])
                return
            }

            guard let compAsset = avAsset,
                  let exporter = AVAssetExportSession(asset: compAsset, presetName: AVAssetExportPresetMediumQuality) else {
                call.resolve(["ok": false, "fileUrl": ""])
                return
            }
            let outUrl = tmpDir.appendingPathComponent("ghosti_vid_\(safeStem).mp4")
            try? fm.removeItem(at: outUrl)
            exporter.outputURL = outUrl
            exporter.outputFileType = .mp4
            exporter.exportAsynchronously {
                if exporter.status == .completed {
                    call.resolve(["ok": true, "fileUrl": outUrl.absoluteString])
                } else {
                    call.resolve(["ok": false, "fileUrl": ""])
                }
            }
        }
    }

    @objc func requestSystemPhotoTrash(_ call: CAPPluginCall) {
        let action = call.getString("action") ?? "move"
        let items = call.getArray("items", JSObject.self) ?? []
        var requestedIds: [String] = []
        var assetIds: [String] = []

        for obj in items {
            let idVal = (obj["id"] as? String) ?? ""
            let nameVal = (obj["name"] as? String) ?? ""
            if !idVal.isEmpty {
                requestedIds.append(idVal)
                if idVal.contains("/") {
                    assetIds.append(idVal)
                }
            } else if !nameVal.isEmpty {
                requestedIds.append(nameVal)
            }
        }

        if action.lowercased() == "restore" || assetIds.isEmpty {
            call.resolve([
                "ok": true,
                "action": action,
                "canceled": false,
                "matchedMediaStoreCount": 0,
                "doneIds": requestedIds
            ])
            return
        }

        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
        if fetched.count == 0 {
            call.resolve([
                "ok": true,
                "action": "move",
                "canceled": false,
                "matchedMediaStoreCount": 0,
                "doneIds": requestedIds
            ])
            return
        }

        PHPhotoLibrary.shared().performChanges({
            PHAssetChangeRequest.deleteAssets(fetched)
        }) { success, _ in
            call.resolve([
                "ok": success,
                "action": "move",
                "canceled": !success,
                "matchedMediaStoreCount": fetched.count,
                "doneIds": success ? requestedIds : []
            ])
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    private func recordAndDispatchIncomingUrl(_ url: URL?) {
        guard let url = url else { return }
        let urlStr = url.absoluteString
        let lower = urlStr.lowercased()
        guard lower.hasPrefix("ghosti://") || lower.contains("invite=") else { return }
        UserDefaults.standard.set(urlStr, forKey: "ghosti_pending_deep_link_url")
        DispatchQueue.main.async { [weak self] in
            guard let bridgeVC = self?.window?.rootViewController as? GhostiBridgeViewController else { return }
            if let jsonData = try? JSONSerialization.data(withJSONObject: ["url": urlStr], options: []),
               let jsonStr = String(data: jsonData, encoding: .utf8) {
                let js = "window.dispatchEvent(new CustomEvent('ghostiNativeDeepLink', { detail: \(jsonStr) }));"
                bridgeVC.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GhostiBridgeViewController()
        window?.makeKeyAndVisible()

        if let openUrl = connectionOptions.urlContexts.first?.url {
            recordAndDispatchIncomingUrl(openUrl)
        } else if let activityUrl = connectionOptions.userActivities.first?.webpageURL {
            recordAndDispatchIncomingUrl(activityUrl)
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let openUrl = URLContexts.first?.url {
            recordAndDispatchIncomingUrl(openUrl)
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if let webUrl = userActivity.webpageURL {
            recordAndDispatchIncomingUrl(webUrl)
        }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
