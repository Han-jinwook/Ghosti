import UIKit
import WebKit
import Capacitor
import Photos
import PhotosUI
import AVFoundation
import AVKit
import Vision

@objc(GhostiBridgeViewController)
class GhostiBridgeViewController: CAPBridgeViewController {
    private let topSafeAreaShieldView = UIView()
    private var isDarkThemeActive = false
    private var lastSyncedSafeKey = ""
    private var lastKeyboardOverlap = -1

    override open var preferredStatusBarStyle: UIStatusBarStyle {
        return isDarkThemeActive ? .lightContent : .darkContent
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GhostiMobileCarePlugin())
        view.backgroundColor = UIColor.white
        webView?.isOpaque = true
        webView?.backgroundColor = UIColor.white
        webView?.scrollView.backgroundColor = UIColor.white
        webView?.scrollView.keyboardDismissMode = .onDrag

        // [iOS 다이나믹 아일랜드·상태바 Safe-Area 물리 보호막]:
        // 키보드 상승이나 빠른 스크롤 시 본문 카드·텍스트가 상단 시계/배터리 영역으로 침범하지 못하도록
        // 하드웨어 safeAreaLayoutGuide.topAnchor 위쪽을 불투명 네이티브 뷰로 상시 차폐합니다.
        topSafeAreaShieldView.translatesAutoresizingMaskIntoConstraints = false
        topSafeAreaShieldView.backgroundColor = UIColor.white
        topSafeAreaShieldView.isUserInteractionEnabled = false
        view.addSubview(topSafeAreaShieldView)
        NSLayoutConstraint.activate([
            topSafeAreaShieldView.topAnchor.constraint(equalTo: view.topAnchor),
            topSafeAreaShieldView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topSafeAreaShieldView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topSafeAreaShieldView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor)
        ])
        view.bringSubviewToFront(topSafeAreaShieldView)

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

    func applyThemeMode(_ isDark: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isDarkThemeActive = isDark
            let bg = isDark
                ? UIColor(red: 9.0 / 255.0, green: 9.0 / 255.0, blue: 11.0 / 255.0, alpha: 1.0)
                : UIColor.white
            self.topSafeAreaShieldView.backgroundColor = bg
            self.view.backgroundColor = bg
            self.webView?.backgroundColor = bg
            self.webView?.scrollView.backgroundColor = bg
            self.view.bringSubviewToFront(self.topSafeAreaShieldView)
            self.setNeedsStatusBarAppearanceUpdate()
        }
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
        if overlap == lastKeyboardOverlap {
            return
        }
        lastKeyboardOverlap = overlap
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
        if lastKeyboardOverlap == 0 {
            return
        }
        lastKeyboardOverlap = 0
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
        syncHardwareSafeAreaCssVars(force: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.syncHardwareSafeAreaCssVars(force: true)
        }
    }

    override open func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        syncHardwareSafeAreaCssVars(force: true)
    }

    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        view.bringSubviewToFront(topSafeAreaShieldView)
        syncHardwareSafeAreaCssVars()
    }

    override open func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { [weak self] _ in
            self?.syncHardwareSafeAreaCssVars(force: true)
        }, completion: { [weak self] _ in
            self?.syncHardwareSafeAreaCssVars(force: true)
        })
    }

    private func syncHardwareSafeAreaCssVars(force: Bool = false) {
        guard isViewLoaded else { return }
        let insets = view.safeAreaInsets
        let top = Int(ceil(insets.top))
        let bottom = Int(ceil(insets.bottom))
        let left = Int(ceil(insets.left))
        let right = Int(ceil(insets.right))
        let key = "\(top),\(bottom),\(left),\(right)"
        if !force && key == lastSyncedSafeKey {
            return
        }
        lastSyncedSafeKey = key
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
        CAPPluginMethod(name: "extractVideoKeyframes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestSystemPhotoTrash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppPermissionSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanInstalledBloatCleaners", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingDeepLink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNativeThemeMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readClipboardText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeClipboardText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "extractVideoNativeOcr", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openNativeVideoPlayerModal", returnType: CAPPluginReturnPromise)
    ]

    private var lastInjectedChangeCount: Int = -1
    private var lastObservedChangeCount: Int = -1

    @objc func readClipboardText(_ call: CAPPluginCall) {
        let force = call.getBool("force") ?? false
        let baselineOnly = call.getBool("baselineOnly") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["ok": false, "text": "", "isSelfInjected": false, "unchanged": true])
                return
            }
            let pb = UIPasteboard.general
            let cc = pb.changeCount
            if baselineOnly && !force {
                self.lastObservedChangeCount = cc
                call.resolve([
                    "ok": true,
                    "text": "",
                    "isSelfInjected": false,
                    "unchanged": true,
                    "changeCount": cc
                ])
                return
            }
            if !force && self.lastInjectedChangeCount >= 0 && cc == self.lastInjectedChangeCount {
                call.resolve([
                    "ok": true,
                    "text": "",
                    "isSelfInjected": true,
                    "unchanged": true,
                    "changeCount": cc
                ])
                return
            }
            if !pb.hasStrings {
                self.lastObservedChangeCount = cc
                call.resolve([
                    "ok": true,
                    "text": "",
                    "isSelfInjected": false,
                    "unchanged": true,
                    "changeCount": cc
                ])
                return
            }
            if !force && self.lastObservedChangeCount >= 0 && cc == self.lastObservedChangeCount {
                call.resolve([
                    "ok": true,
                    "text": "",
                    "isSelfInjected": false,
                    "unchanged": true,
                    "changeCount": cc
                ])
                return
            }
            let raw = (pb.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let limited = raw.count > 32000 ? String(raw.prefix(32000)) : raw
            self.lastObservedChangeCount = cc
            call.resolve([
                "ok": true,
                "text": limited,
                "isSelfInjected": (self.lastInjectedChangeCount >= 0 && cc == self.lastInjectedChangeCount),
                "unchanged": false,
                "changeCount": cc
            ])
        }
    }

    @objc func writeClipboardText(_ call: CAPPluginCall) {
        let raw = (call.getString("text") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else {
            call.resolve(["ok": false])
            return
        }
        let limited = raw.count > 32000 ? String(raw.prefix(32000)) : raw
        DispatchQueue.main.async { [weak self] in
            // iOS는 앱이 백그라운드/비활성(.active 아님) 상태일 때 UIPasteboard 쓰기를 무음 거부하므로,
            // 거짓 성공(ok:true)을 반환해 영구 스킵되지 않도록 false 반환 후 포그라운드 복귀 시 즉시 재주입 보장
            if UIApplication.shared.applicationState != .active {
                call.resolve(["ok": false, "reason": "APP_NOT_ACTIVE"])
                return
            }
            let pb = UIPasteboard.general
            pb.string = limited
            let cc = pb.changeCount
            self?.lastInjectedChangeCount = cc
            self?.lastObservedChangeCount = cc
            call.resolve(["ok": true, "changeCount": cc])
        }
    }

    @objc func setNativeThemeMode(_ call: CAPPluginCall) {
        let isDark = call.getBool("dark") ?? false
        if let vc = self.bridge?.viewController as? GhostiBridgeViewController {
            vc.applyThemeMode(isDark)
        }
        call.resolve(["ok": true])
    }

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
        let thumbMaxDim = min(640, max(240, call.getInt("thumbMaxDim") ?? 512))
        let includeVideos = call.getBool("includeVideos") ?? (offset == 0)
        let promptPerm = call.getBool("promptPermission") ?? true
        let forceExpandSelected = call.getBool("forceExpandSelected") ?? false

        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if #available(iOS 14, *), status == .limited, forceExpandSelected {
            DispatchQueue.main.async {
                // [PhotosUI 프레임워크 강제 심볼 앵커링 & 미연결 셀렉터 충돌 원천 차단]:
                // presentLimitedLibraryPicker는 Photos가 아닌 PhotosUI의 ObjC 카테고리 확장이므로,
                // 구체 타입 심볼(PHPickerConfiguration)을 참조해 링커 데드스트립을 막고 최상단 VC에서 완료 콜백(iOS 15+)으로 안전 호출합니다.
                let _ = PHPickerConfiguration.self
                var presenter: UIViewController? = self.bridge?.viewController
                while let nextPresented = presenter?.presentedViewController, !nextPresented.isBeingDismissed {
                    presenter = nextPresented
                }

                guard let safePresenter = presenter else {
                    self.runPhotoKitScan(call: call, offset: offset, limit: limit, thumbMaxDim: thumbMaxDim, includeVideos: includeVideos, isLimited: true)
                    return
                }

                let library = PHPhotoLibrary.shared()
                if #available(iOS 15, *),
                   library.responds(to: NSSelectorFromString("presentLimitedLibraryPickerFromViewController:completionHandler:")) {
                    library.presentLimitedLibraryPicker(from: safePresenter) { _ in
                        let refreshedLim = PHPhotoLibrary.authorizationStatus(for: .readWrite) == .limited
                        self.runPhotoKitScan(
                            call: call,
                            offset: offset,
                            limit: limit,
                            thumbMaxDim: thumbMaxDim,
                            includeVideos: includeVideos,
                            isLimited: refreshedLim
                        )
                    }
                } else if library.responds(to: NSSelectorFromString("presentLimitedLibraryPickerFromViewController:")) {
                    library.presentLimitedLibraryPicker(from: safePresenter)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        self.runPhotoKitScan(call: call, offset: offset, limit: limit, thumbMaxDim: thumbMaxDim, includeVideos: includeVideos, isLimited: true)
                    }
                } else {
                    if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(settingsUrl, options: [:], completionHandler: nil)
                    }
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
            // [Android MediaStore DATE_MODIFIED DESC 1:1 정합화 & 연사(Burst) 전체 프레임 개방]:
            // 1) 과거 EXIF 촬영일(creationDate)을 가진 최근 다운로드/공유 중복 사진이 수백 장 뒤로 밀려 스캔에서 누락되지 않도록
            //    iPhone '최근 항목(Recents / .smartAlbumUserLibrary)' 컬렉션을 역순(내 폰에 가장 최근 저장된 순서)으로 최우선 조회합니다.
            // 2) includeAllBurstAssets = true를 지정하여 iOS 연사 묶음 내부의 개별 사진이 숨겨지지 않고 모두 중복·연사 분석기에 전달되게 합니다.
            var orderedAssets: [PHAsset] = []
            var seenLocalIds = Set<String>()

            let libCols = PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: .smartAlbumUserLibrary, options: nil)
            if let recentsCol = libCols.firstObject {
                let recentsOpts = PHFetchOptions()
                recentsOpts.includeAllBurstAssets = true
                recentsOpts.includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared, .typeiTunesSynced]
                recentsOpts.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
                let recents = PHAsset.fetchAssets(in: recentsCol, options: recentsOpts)
                if recents.count > 0 {
                    for rIdx in stride(from: recents.count - 1, through: 0, by: -1) {
                        let a = recents.object(at: rIdx)
                        if seenLocalIds.insert(a.localIdentifier).inserted {
                            orderedAssets.append(a)
                        }
                    }
                }
            }

            let allImgOpts = PHFetchOptions()
            allImgOpts.includeAllBurstAssets = true
            allImgOpts.includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared, .typeiTunesSynced]
            allImgOpts.sortDescriptors = [NSSortDescriptor(key: "modificationDate", ascending: false)]
            let fallbackAssets = PHAsset.fetchAssets(with: .image, options: allImgOpts)
            if fallbackAssets.count > 0 {
                for fIdx in 0..<fallbackAssets.count {
                    let a = fallbackAssets.object(at: fIdx)
                    if seenLocalIds.insert(a.localIdentifier).inserted {
                        orderedAssets.append(a)
                    }
                }
            }

            let totalPhotoCount = orderedAssets.count
            let endIdx = min(totalPhotoCount, offset + limit)

            let imgManager = PHImageManager.default()
            let reqOpts = PHImageRequestOptions()
            reqOpts.isSynchronous = true
            reqOpts.deliveryMode = .highQualityFormat
            reqOpts.resizeMode = .exact
            reqOpts.isNetworkAccessAllowed = true

            var photosList: [[String: Any]] = []
            if offset < endIdx {
                for idx in offset..<endIdx {
                    autoreleasepool {
                        let asset = orderedAssets[idx]
                        var thumbDataUrl = ""
                        let targetSize = CGSize(width: CGFloat(thumbMaxDim), height: CGFloat(thumbMaxDim))
                        imgManager.requestImage(
                            for: asset,
                            targetSize: targetSize,
                            contentMode: .aspectFit,
                            options: reqOpts
                        ) { uiImg, _ in
                            if let img = uiImg, let jpeg = img.jpegData(compressionQuality: 0.82) {
                                thumbDataUrl = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                            }
                        }

                        if thumbDataUrl.isEmpty {
                            return
                        }

                        let resItem = PHAssetResource.assetResources(for: asset).first
                        let fileName = resItem?.originalFilename ?? "IMG_\(idx + 1).jpg"
                        let realFileSize = (resItem?.value(forKey: "fileSize") as? Int) ?? 0
                        let estSize = realFileSize > 0 ? realFileSize : (max(250_000, (asset.pixelWidth * asset.pixelHeight) / 4) + (idx % 97))
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
                let vidFetchOpts = PHFetchOptions()
                vidFetchOpts.sortDescriptors = [NSSortDescriptor(key: "modificationDate", ascending: false)]
                let vidAssets = PHAsset.fetchAssets(with: .video, options: vidFetchOpts)
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
        let forceTranscode = call.getBool("forceTranscode") ?? false
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

        let filePrefix = forceTranscode ? "ghosti_vid_h264_v2_" : "ghosti_vid_v2_"
        let outUrl = tmpDir.appendingPathComponent("\(filePrefix)\(safeStem).mp4")
        if let attrs = try? fm.attributesOfItem(atPath: outUrl.path),
           let sz = attrs[.size] as? NSNumber,
           sz.int64Value > 4096 {
            call.resolve(["ok": true, "fileUrl": outUrl.path])
            return
        }

        let vOpts = PHVideoRequestOptions()
        vOpts.isNetworkAccessAllowed = true
        vOpts.deliveryMode = .highQualityFormat

        PHImageManager.default().requestAVAsset(forVideo: asset, options: vOpts) { avAsset, _, _ in
            guard let compAsset = avAsset else {
                call.resolve(["ok": false, "fileUrl": ""])
                return
            }

            var isPureAvcMp4 = false
            if !forceTranscode,
               let urlAsset = compAsset as? AVURLAsset,
               urlAsset.url.pathExtension.lowercased() == "mp4" {
                let vTracks = compAsset.tracks(withMediaType: .video)
                if let firstTrack = vTracks.first,
                   let desc = firstTrack.formatDescriptions.first {
                    let subType = CMFormatDescriptionGetMediaSubType(desc as! CMFormatDescription)
                    // 'avc1' = 0x61766331
                    if subType == 0x61766331 {
                        isPureAvcMp4 = true
                    }
                }
                if isPureAvcMp4 {
                    try? fm.removeItem(at: outUrl)
                    if (try? fm.copyItem(at: urlAsset.url, to: outUrl)) != nil,
                       let attrs = try? fm.attributesOfItem(atPath: outUrl.path),
                       let sz = attrs[.size] as? NSNumber,
                       sz.int64Value > 4096 {
                        call.resolve(["ok": true, "fileUrl": outUrl.path])
                        return
                    }
                }
            }

            // iOS 샌드박스 외부(/var/mobile/Media/DCIM) 파일 및 HEVC(.MOV) 영상을 AVFoundation 권한 토큰으로 안전하게 H.264 Faststart MP4로 추출
            let preset = AVAssetExportSession.exportPresets(compatibleWith: compAsset).contains(AVAssetExportPreset1280x720)
                ? AVAssetExportPreset1280x720
                : AVAssetExportPresetMediumQuality
            guard let exporter = AVAssetExportSession(asset: compAsset, presetName: preset) else {
                call.resolve(["ok": false, "fileUrl": ""])
                return
            }
            try? fm.removeItem(at: outUrl)
            exporter.outputURL = outUrl
            exporter.outputFileType = .mp4
            exporter.shouldOptimizeForNetworkUse = true
            exporter.exportAsynchronously {
                if exporter.status == .completed, fm.fileExists(atPath: outUrl.path) {
                    call.resolve(["ok": true, "fileUrl": outUrl.path])
                } else {
                    call.resolve(["ok": false, "fileUrl": ""])
                }
            }
        }
    }

    private struct IosVideoFrameCandidate {
        let timeSec: Int
        let lumaGrid: [Float]
        let sharpness: Float
        let dataUrl: String
    }

    private func evaluateIosVideoFrame(_ cgImg: CGImage, timeSec: Int) -> IosVideoFrameCandidate? {
        let w = cgImg.width
        let h = cgImg.height
        if w < 32 || h < 32 { return nil }

        let graySpace = CGColorSpaceCreateDeviceGray()
        let gw = 64
        let gh = 36
        var gridBuf = [UInt8](repeating: 0, count: gw * gh)
        guard let gridCtx = CGContext(
            data: &gridBuf,
            width: gw,
            height: gh,
            bitsPerComponent: 8,
            bytesPerRow: gw,
            space: graySpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else {
            return nil
        }
        gridCtx.interpolationQuality = .medium
        gridCtx.draw(cgImg, in: CGRect(x: 0, y: 0, width: gw, height: gh))

        var lumaGrid = [Float](repeating: 0, count: gw * gh)
        var sum = 0.0
        var sqSum = 0.0
        for i in 0..<(gw * gh) {
            let v = Double(gridBuf[i])
            lumaGrid[i] = Float(v)
            sum += v
            sqSum += v * v
        }
        let cntD = Double(gw * gh)
        let mean = sum / cntD
        let std = sqrt(max(0.0, sqSum / cntD - mean * mean))
        if std < 4.2 {
            return nil
        }

        let shortSide = max(1, min(w, h))
        let sScale = min(1.0, 240.0 / Double(shortSide))
        let sw = max(32, Int(round(Double(w) * sScale)))
        let sh = max(32, Int(round(Double(h) * sScale)))
        var lapBuf = [UInt8](repeating: 0, count: sw * sh)
        guard let lapCtx = CGContext(
            data: &lapBuf,
            width: sw,
            height: sh,
            bitsPerComponent: 8,
            bytesPerRow: sw,
            space: graySpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else {
            return nil
        }
        lapCtx.interpolationQuality = .medium
        lapCtx.draw(cgImg, in: CGRect(x: 0, y: 0, width: sw, height: sh))

        var lapAcc: Double = 0.0
        var lapCnt: Int = 0
        for y in 1..<(sh - 1) {
            let rOff = y * sw
            for x in 1..<(sw - 1) {
                let idx = rOff + x
                let c2 = 2 * Int(lapBuf[idx])
                let lx = abs(c2 - Int(lapBuf[idx - 1]) - Int(lapBuf[idx + 1]))
                let ly = abs(c2 - Int(lapBuf[idx - sw]) - Int(lapBuf[idx + sw]))
                lapAcc += Double(lx + ly)
                lapCnt += 1
            }
        }
        let sharpness = lapCnt > 0 ? Float(lapAcc / Double(lapCnt)) : 0.0
        let uiImg = UIImage(cgImage: cgImg)
        guard let jpeg = uiImg.jpegData(compressionQuality: 0.92) else {
            return nil
        }
        return IosVideoFrameCandidate(
            timeSec: timeSec,
            lumaGrid: lumaGrid,
            sharpness: sharpness,
            dataUrl: "data:image/jpeg;base64," + jpeg.base64EncodedString()
        )
    }

    @objc func extractVideoKeyframes(_ call: CAPPluginCall) {
        let rawId = call.getString("id") ?? ""
        let maxFrames = max(1, min(10, call.getInt("maxFrames") ?? 8))
        let localId = rawId.hasPrefix("mobile_vid_")
            ? String(rawId.dropFirst("mobile_vid_".count))
            : rawId
        if localId.isEmpty {
            call.resolve(["ok": false, "frames": []])
            return
        }

        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
        guard let asset = fetched.firstObject else {
            call.resolve(["ok": false, "frames": []])
            return
        }

        let vOpts = PHVideoRequestOptions()
        vOpts.isNetworkAccessAllowed = true
        vOpts.deliveryMode = .highQualityFormat

        PHImageManager.default().requestAVAsset(forVideo: asset, options: vOpts) { avAsset, _, _ in
            guard let compAsset = avAsset else {
                call.resolve(["ok": false, "frames": []])
                return
            }
            DispatchQueue.global(qos: .userInitiated).async {
                let durSec = max(0.8, CMTimeGetSeconds(compAsset.duration))
                let candCount = durSec <= 2.4 ? 4 : (durSec <= 7.0 ? 8 : 12)
                let generator = AVAssetImageGenerator(asset: compAsset)
                generator.appliesPreferredTrackTransform = true
                generator.maximumSize = CGSize(width: 1920, height: 1920)
                let tol = CMTime(seconds: durSec <= 30.0 ? 0.06 : 0.25, preferredTimescale: 600)
                generator.requestedTimeToleranceBefore = tol
                generator.requestedTimeToleranceAfter = tol

                var candidates: [IosVideoFrameCandidate] = []
                for i in 0..<candCount {
                    let ratio = candCount == 1 ? 0.35 : (0.08 + 0.82 * (Double(i) / Double(candCount - 1)))
                    let tSec = max(0.08, min(durSec - 0.12, durSec * ratio))
                    let cmTime = CMTime(seconds: tSec, preferredTimescale: 600)
                    autoreleasepool {
                        if let cgImg = try? generator.copyCGImage(at: cmTime, actualTime: nil),
                           let cand = self.evaluateIosVideoFrame(cgImg, timeSec: max(0, Int(round(tSec)))) {
                            candidates.append(cand)
                        }
                    }
                }

                var framesList: [[String: Any]] = []
                if !candidates.isEmpty {
                    var clusters: [[IosVideoFrameCandidate]] = [[candidates[0]]]
                    for idx in 1..<candidates.count {
                        let cur = candidates[idx]
                        let prev = clusters[clusters.count - 1].last!
                        var diffAcc: Float = 0.0
                        for k in 0..<cur.lumaGrid.count {
                            diffAcc += abs(cur.lumaGrid[k] - prev.lumaGrid[k])
                        }
                        let mad = diffAcc / Float(cur.lumaGrid.count)
                        if mad < 5.0 {
                            clusters[clusters.count - 1].append(cur)
                        } else {
                            clusters.append([cur])
                        }
                    }

                    var selected: [IosVideoFrameCandidate] = clusters.compactMap { cl in
                        cl.max(by: { $0.sharpness < $1.sharpness })
                    }

                    if selected.count < min(3, candidates.count) {
                        let bySharp = candidates.sorted(by: { $0.sharpness > $1.sharpness })
                        for cand in bySharp {
                            if selected.count >= min(4, maxFrames) { break }
                            let tooClose = selected.contains(where: { abs($0.timeSec - cand.timeSec) <= 1 })
                            if !tooClose {
                                selected.append(cand)
                            }
                        }
                        selected.sort(by: { $0.timeSec < $1.timeSec })
                    }

                    for item in selected.prefix(maxFrames) {
                        framesList.append([
                            "timeSec": item.timeSec,
                            "dataUrl": item.dataUrl
                        ])
                    }
                }

                call.resolve([
                    "ok": !framesList.isEmpty,
                    "frames": framesList
                ])
            }
        }
    }

    private func purgeLegacyIosTrashVaultIfNeeded() {
        let fm = FileManager.default
        let base = fm.urls(for: .cachesDirectory, in: .userDomainMask).first ?? fm.temporaryDirectory
        let legacyDir = base.appendingPathComponent("ghosti_ios_trash_vault", isDirectory: true)
        if fm.fileExists(atPath: legacyDir.path) {
            try? fm.removeItem(at: legacyDir)
        }
    }

    @objc func requestSystemPhotoTrash(_ call: CAPPluginCall) {
        purgeLegacyIosTrashVaultIfNeeded()

        let action = call.getString("action") ?? "move"
        let isMoveToTrash = action.lowercased() != "restore"
        let protectedKeepSet = Set(call.getArray("protectedKeepIds", String.self) ?? [])
        let items = call.getArray("items", JSObject.self) ?? []
        var requestedIds: [String] = []
        var assetIds: [String] = []

        for obj in items {
            let idVal = (obj["id"] as? String) ?? ""
            let nameVal = (obj["name"] as? String) ?? ""
            if isMoveToTrash && ((!idVal.isEmpty && protectedKeepSet.contains(idVal)) || (!nameVal.isEmpty && protectedKeepSet.contains(nameVal))) {
                continue
            }
            if !idVal.isEmpty {
                requestedIds.append(idVal)
                if idVal.contains("/") {
                    assetIds.append(idVal)
                }
            } else if !nameVal.isEmpty {
                requestedIds.append(nameVal)
            }
        }

        // [대안 B · 구글 포토 iOS / 애플 순정 표준]
        // 애플 PhotoKit은 FaceID로 잠긴 『최근 삭제된 항목』에서 외부 앱이 사진을 꺼내오는(Undelete) API를 보안 정책상 제공하지 않으므로,
        // 앱 캐시 사본 백업이나 중복 사본 생성을 하지 않고 아이폰 순정 『사진 ➔ 최근 삭제된 항목(FaceID)』 복원 안내로 일원화합니다.
        if !isMoveToTrash {
            call.resolve([
                "ok": false,
                "action": "restore",
                "canceled": false,
                "matchedMediaStoreCount": 0,
                "doneIds": [],
                "error": "아이폰은 애플 FaceID 보안 정책에 따라 『사진 ➔ 최근 삭제된 항목』에서 30일 내 언제든 원본 그대로 복원할 수 있습니다."
            ])
            return
        }

        if assetIds.isEmpty {
            call.resolve([
                "ok": true,
                "action": action,
                "canceled": false,
                "matchedMediaStoreCount": 0,
                "doneIds": requestedIds
            ])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
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

    // =========================================================================
    // [모바일 정공법 — 대안 B (iOS)]:
    // 1) Apple Vision 온디바이스 한국어 OCR (VNRecognizeTextRequest ko-KR, Neural Engine 0.2~0.4초)
    // 2) AVPlayerViewController 순정 하드웨어 재생 + 하단 추출 한글·복사 통합 모달 (무변환 0.05초)
    // =========================================================================
    fileprivate struct IosNativeOcrLine {
        let timeSec: Int
        let timestamp: String
        let text: String
    }

    fileprivate struct IosNativeVideoOcrResult {
        let hasText: Bool
        let lines: [IosNativeOcrLine]
        let fullText: String

        func toDict() -> [String: Any] {
            let arr: [[String: Any]] = lines.map { item in
                [
                    "timeSec": item.timeSec,
                    "timestamp": item.timestamp,
                    "text": item.text
                ]
            }
            return [
                "ok": true,
                "hasText": hasText,
                "ocrLines": arr,
                "fullText": fullText
            ]
        }
    }

    private static var iosVideoOcrCache: [String: IosNativeVideoOcrResult] = [:]
    private static let iosVideoOcrCacheLock = NSLock()

    fileprivate static func formatMmSs(_ secVal: Int) -> String {
        let s = max(0, secVal)
        return String(format: "%02d:%02d", s / 60, s % 60)
    }

    private struct IosCleanedFrameOcr {
        let text: String
        let qualityScore: Float
        let normSig: String
    }

    private static func computeIosBigramOverlap(_ a: String, _ b: String) -> Double {
        if a.isEmpty || b.isEmpty { return 0.0 }
        if a == b { return 1.0 }
        if a.count >= 4 && b.contains(a) { return 0.92 }
        if b.count >= 4 && a.contains(b) { return 0.92 }
        let charsA = Array(a)
        let charsB = Array(b)
        if charsA.count < 2 || charsB.count < 2 { return 0.0 }
        var setA = Set<String>()
        for i in 0..<(charsA.count - 1) {
            setA.insert(String(charsA[i...i+1]))
        }
        var setB = Set<String>()
        for i in 0..<(charsB.count - 1) {
            setB.insert(String(charsB[i...i+1]))
        }
        let inter = setA.intersection(setB).count
        return Double(inter) / Double(max(1, min(setA.count, setB.count)))
    }

    private static func recognizeKoreanTextInCGImage(_ cgImg: CGImage) -> IosCleanedFrameOcr {
        var observations: [VNRecognizedTextObservation] = []
        let req = VNRecognizeTextRequest { request, _ in
            if let res = request.results as? [VNRecognizedTextObservation] {
                observations = res
            }
        }
        req.recognitionLevel = .accurate
        req.usesLanguageCorrection = true
        req.recognitionLanguages = ["ko-KR", "en-US"]

        let handler = VNImageRequestHandler(cgImage: cgImg, options: [:])
        do {
            try handler.perform([req])
        } catch {
            return IosCleanedFrameOcr(text: "", qualityScore: 0, normSig: "")
        }
        if observations.isEmpty { return IosCleanedFrameOcr(text: "", qualityScore: 0, normSig: "") }

        // Vision 좌표계는 좌하단 원점(y=1.0이 상단)이므로 상단부터 하단 순으로 정렬
        let sortedObs = observations.sorted { a, b in
            let ay = a.boundingBox.midY
            let by = b.boundingBox.midY
            let minH = max(0.015, min(a.boundingBox.height, b.boundingBox.height))
            if abs(ay - by) <= minH * 0.55 {
                return a.boundingBox.minX < b.boundingBox.minX
            }
            return ay > by
        }

        let watermarkRx = try? NSRegularExpression(
            pattern: "(notebooklm|^capcut$|^veo$|^kapwing$|^[xyv]?rec[eo@0]rder$|mobizen|bandicam|gomcam|^ocam$|az\\s*screen|^inshot$|kinemaster|vivavideo|filmora)",
            options: [.caseInsensitive]
        )
        let statusBarRx = try? NSRegularExpression(
            pattern: "^(?:SKT|KT|LG\\s*U\\+|U\\+|LTE|5G|\\d{1,3}%|\\d{1,2}:\\d{2})$",
            options: [.caseInsensitive]
        )
        let kbdTokenRx = try? NSRegularExpression(
            pattern: "^(?:스페이스|한/?영|완료|이동|검색|123|!#1|!#7|[ㄱ-ㅎㅏ-ㅣ]{1,3})$",
            options: [.caseInsensitive]
        )

        var kept: [String] = []
        var seenNorm = Set<String>()
        var totalQuality: Float = 0.0
        for obs in sortedObs {
            guard let topCand = obs.topCandidates(1).first else { continue }
            // 모션 블러·배경 노이즈로 인한 저신뢰도 오인식 라인 원천 컷오프
            if topCand.confidence < 0.62 { continue }
            let cleaned = topCand.string
                .replacingOccurrences(of: "[ㄱ-ㅎㅏ-ㅣ~`^|\\\\<>{}\\[\\]©®™]+", with: " ", options: .regularExpression)
                .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if cleaned.count < 2 { continue }
            let nsRange = NSRange(cleaned.startIndex..<cleaned.endIndex, in: cleaned)
            if obs.boundingBox.minY >= 0.94, let sRx = statusBarRx, sRx.firstMatch(in: cleaned, options: [], range: nsRange) != nil {
                continue
            }
            if let wRx = watermarkRx, wRx.firstMatch(in: cleaned, options: [], range: nsRange) != nil {
                continue
            }
            if let kRx = kbdTokenRx, kRx.firstMatch(in: cleaned, options: [], range: nsRange) != nil {
                continue
            }
            var koreanCount = 0
            var alnumCount = 0
            var symbolCount = 0
            for scalar in cleaned.unicodeScalars {
                if scalar.value >= 0xAC00 && scalar.value <= 0xD7A3 {
                    koreanCount += 1
                } else if CharacterSet.alphanumerics.contains(scalar) {
                    alnumCount += 1
                } else if !CharacterSet.whitespacesAndNewlines.contains(scalar) {
                    symbolCount += 1
                }
            }
            if koreanCount == 0 && alnumCount < 3 { continue }
            if koreanCount == 1 && alnumCount == 0 && topCand.confidence < 0.82 { continue }
            if symbolCount > koreanCount + alnumCount { continue }
            let normKey = cleaned.lowercased().replacingOccurrences(of: "[^가-힣a-z0-9]+", with: "", options: .regularExpression)
            if normKey.count < 2 { continue }
            if !seenNorm.contains(normKey) {
                seenNorm.insert(normKey)
                kept.append(cleaned)
                totalQuality += Float(koreanCount * 2 + alnumCount) * topCand.confidence
            }
        }
        if kept.isEmpty { return IosCleanedFrameOcr(text: "", qualityScore: 0, normSig: "") }
        let joined = kept.joined(separator: " · ")
        let normSig = joined.lowercased().replacingOccurrences(of: "[^가-힣a-z0-9]+", with: "", options: .regularExpression)
        return IosCleanedFrameOcr(text: joined, qualityScore: totalQuality, normSig: normSig)
    }

    fileprivate static func extractIosVideoNativeOcrInternal(
        localId: String,
        maxFrames: Int,
        completion: @escaping (IosNativeVideoOcrResult) -> Void
    ) {
        iosVideoOcrCacheLock.lock()
        if let cached = iosVideoOcrCache[localId] {
            iosVideoOcrCacheLock.unlock()
            completion(cached)
            return
        }
        iosVideoOcrCacheLock.unlock()

        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
        guard let asset = fetched.firstObject else {
            completion(IosNativeVideoOcrResult(hasText: false, lines: [], fullText: ""))
            return
        }

        let vOpts = PHVideoRequestOptions()
        vOpts.isNetworkAccessAllowed = true
        vOpts.deliveryMode = .highQualityFormat

        PHImageManager.default().requestAVAsset(forVideo: asset, options: vOpts) { avAsset, _, _ in
            guard let compAsset = avAsset else {
                completion(IosNativeVideoOcrResult(hasText: false, lines: [], fullText: ""))
                return
            }
            DispatchQueue.global(qos: .userInitiated).async {
                let durSec = max(0.8, CMTimeGetSeconds(compAsset.duration))
                let totalSec = max(1, Int(floor(durSec)))
                let targetCap = max(4, min(12, maxFrames))
                var candidateSecs: [Int] = []
                var seenSecs = Set<Int>()
                if totalSec <= targetCap {
                    for s in 0...totalSec {
                        if Double(s) <= durSec - 0.12 || s == 0 {
                            if seenSecs.insert(s).inserted {
                                candidateSecs.append(s)
                            }
                        }
                    }
                } else {
                    for i in 0..<targetCap {
                        let ratio = targetCap == 1 ? 0.0 : (Double(i) / Double(targetCap - 1))
                        let sec = max(0, min(totalSec, Int(round(Double(totalSec) * ratio))))
                        if seenSecs.insert(sec).inserted {
                            candidateSecs.append(sec)
                        }
                    }
                }

                let generator = AVAssetImageGenerator(asset: compAsset)
                generator.appliesPreferredTrackTransform = true
                generator.maximumSize = CGSize(width: 1920, height: 1920)
                // 정확한 정수 초(sec)의 실제 프레임을 추출하여 1초 앞당김 오차 원천 차단
                let tol = CMTime(seconds: 0.05, preferredTimescale: 600)
                generator.requestedTimeToleranceBefore = tol
                generator.requestedTimeToleranceAfter = tol

                var entries: [IosNativeOcrLine] = []
                var entryNormSigs: [String] = []
                var entryQualities: [Float] = []
                for secInt in candidateSecs {
                    let tSec = secInt == 0 ? min(0.12, durSec * 0.5) : min(durSec - 0.08, Double(secInt))
                    let cmTime = CMTime(seconds: tSec, preferredTimescale: 600)
                    autoreleasepool {
                        if let cgImg = try? generator.copyCGImage(at: cmTime, actualTime: nil) {
                            let cleaned = recognizeKoreanTextInCGImage(cgImg)
                            if !cleaned.text.isEmpty && !cleaned.normSig.isEmpty {
                                if !entries.isEmpty {
                                    let lastIdx = entries.count - 1
                                    let overlap = computeIosBigramOverlap(entryNormSigs[lastIdx], cleaned.normSig)
                                    if overlap >= 0.72 {
                                        if cleaned.qualityScore > entryQualities[lastIdx] * 1.03 {
                                            let prevEntry = entries[lastIdx]
                                            entries[lastIdx] = IosNativeOcrLine(
                                                timeSec: prevEntry.timeSec,
                                                timestamp: prevEntry.timestamp,
                                                text: cleaned.text
                                            )
                                            entryNormSigs[lastIdx] = cleaned.normSig
                                            entryQualities[lastIdx] = cleaned.qualityScore
                                        }
                                        return
                                    }
                                }
                                entries.append(
                                    IosNativeOcrLine(
                                        timeSec: secInt,
                                        timestamp: formatMmSs(secInt),
                                        text: cleaned.text
                                    )
                                )
                                entryNormSigs.append(cleaned.normSig)
                                entryQualities.append(cleaned.qualityScore)
                            }
                        }
                    }
                }
                let fullText = entries.map { "[\($0.timestamp)] \($0.text)" }.joined(separator: "\n")
                let result = IosNativeVideoOcrResult(hasText: !entries.isEmpty, lines: entries, fullText: fullText)
                iosVideoOcrCacheLock.lock()
                iosVideoOcrCache[localId] = result
                iosVideoOcrCacheLock.unlock()
                completion(result)
            }
        }
    }

    @objc func extractVideoNativeOcr(_ call: CAPPluginCall) {
        let rawId = call.getString("id") ?? ""
        let maxFrames = max(1, min(12, call.getInt("maxFrames") ?? 8))
        let localId = rawId.hasPrefix("mobile_vid_")
            ? String(rawId.dropFirst("mobile_vid_".count))
            : rawId
        if localId.isEmpty {
            call.resolve(["ok": false, "hasText": false, "ocrLines": [], "fullText": ""])
            return
        }
        Self.extractIosVideoNativeOcrInternal(localId: localId, maxFrames: maxFrames) { result in
            call.resolve(result.toDict())
        }
    }

    @objc func openNativeVideoPlayerModal(_ call: CAPPluginCall) {
        let rawId = call.getString("id") ?? ""
        let title = call.getString("title") ?? "내 스마트폰 동영상"
        let durationText = call.getString("durationText") ?? ""
        let seekSec = max(0, call.getInt("seekSec") ?? 0)
        let preloadedArr = call.getArray("ocrLines", JSObject.self) ?? []
        let localId = rawId.hasPrefix("mobile_vid_")
            ? String(rawId.dropFirst("mobile_vid_".count))
            : rawId
        if localId.isEmpty {
            call.resolve(["ok": false])
            return
        }

        var initialLines: [IosNativeOcrLine] = []
        for obj in preloadedArr {
            let tx = ((obj["text"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if tx.isEmpty { continue }
            let tsSec = max(0, (obj["timeSec"] as? Int) ?? 0)
            let tsStr = (obj["timestamp"] as? String) ?? Self.formatMmSs(tsSec)
            initialLines.append(IosNativeOcrLine(timeSec: tsSec, timestamp: tsStr, text: tx))
        }

        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.bridge?.viewController else {
                call.resolve(["ok": false])
                return
            }
            let modalVC = GhostiNativeVideoModalViewController(
                localId: localId,
                videoTitle: title,
                durationText: durationText,
                initialSeekSec: seekSec,
                initialLines: initialLines
            ) { finalResult in
                self?.lastInjectedChangeCount = UIPasteboard.general.changeCount
                var payload = finalResult?.toDict() ?? [
                    "ok": true,
                    "hasText": false,
                    "ocrLines": [],
                    "fullText": ""
                ]
                payload["closed"] = true
                call.resolve(payload)
            }
            modalVC.modalPresentationStyle = .overFullScreen
            modalVC.modalTransitionStyle = .crossDissolve
            presenter.present(modalVC, animated: true)
        }
    }
}

private final class GhostiNativeVideoModalViewController: UIViewController {
    private let localId: String
    private let videoTitle: String
    private let durationText: String
    private let initialSeekSec: Int
    private var currentOcrResult: GhostiMobileCarePlugin.IosNativeVideoOcrResult?
    private let onDismissCallback: (GhostiMobileCarePlugin.IosNativeVideoOcrResult?) -> Void
    private var didInvokeDismiss = false

    private let playerVC = AVPlayerViewController()
    private let ocrTitleLabel = UILabel()
    private let copyAllButton = UIButton(type: .system)
    private let linesStack = UIStackView()
    private var lineTimeSecs: [Int] = []
    private var lineTexts: [String] = []

    init(
        localId: String,
        videoTitle: String,
        durationText: String,
        initialSeekSec: Int,
        initialLines: [GhostiMobileCarePlugin.IosNativeOcrLine],
        onDismissCallback: @escaping (GhostiMobileCarePlugin.IosNativeVideoOcrResult?) -> Void
    ) {
        self.localId = localId
        self.videoTitle = videoTitle
        self.durationText = durationText
        self.initialSeekSec = initialSeekSec
        if !initialLines.isEmpty {
            let full = initialLines.map { "[\($0.timestamp)] \($0.text)" }.joined(separator: "\n")
            self.currentOcrResult = GhostiMobileCarePlugin.IosNativeVideoOcrResult(
                hasText: true,
                lines: initialLines,
                fullText: full
            )
        }
        self.onDismissCallback = onDismissCallback
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 9.0 / 255.0, green: 13.0 / 255.0, blue: 22.0 / 255.0, alpha: 1.0)

        let headerStack = UIStackView()
        headerStack.axis = .horizontal
        headerStack.alignment = .center
        headerStack.spacing = 10
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        let titleStack = UIStackView()
        titleStack.axis = .vertical
        titleStack.spacing = 3

        let titleLbl = UILabel()
        titleLbl.text = videoTitle
        titleLbl.textColor = .white
        titleLbl.font = UIFont.boldSystemFont(ofSize: 16.5)
        titleLbl.numberOfLines = 2

        let subLbl = UILabel()
        subLbl.text = durationText.isEmpty
            ? "🎬 아이폰 원본 하드웨어 즉시 재생"
            : "⏱️ 전체 길이 \(durationText) · 원본 무변환 즉시 재생"
        subLbl.textColor = UIColor(red: 148.0 / 255.0, green: 163.0 / 255.0, blue: 184.0 / 255.0, alpha: 1.0)
        subLbl.font = UIFont.systemFont(ofSize: 12.0, weight: .medium)

        titleStack.addArrangedSubview(titleLbl)
        titleStack.addArrangedSubview(subLbl)

        let closeBtn = UIButton(type: .system)
        closeBtn.setTitle("✕ 닫기", for: .normal)
        closeBtn.setTitleColor(.white, for: .normal)
        closeBtn.titleLabel?.font = UIFont.boldSystemFont(ofSize: 13.5)
        closeBtn.backgroundColor = UIColor(red: 30.0 / 255.0, green: 41.0 / 255.0, blue: 59.0 / 255.0, alpha: 1.0)
        closeBtn.layer.cornerRadius = 18
        closeBtn.layer.borderWidth = 1
        closeBtn.layer.borderColor = UIColor(red: 71.0 / 255.0, green: 85.0 / 255.0, blue: 105.0 / 255.0, alpha: 1.0).cgColor
        closeBtn.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        closeBtn.setContentHuggingPriority(.required, for: .horizontal)
        closeBtn.setContentCompressionResistancePriority(.required, for: .horizontal)
        closeBtn.addTarget(self, action: #selector(handleCloseTapped), for: .touchUpInside)

        headerStack.addArrangedSubview(titleStack)
        headerStack.addArrangedSubview(closeBtn)
        view.addSubview(headerStack)

        let playerContainer = UIView()
        playerContainer.backgroundColor = .black
        playerContainer.layer.cornerRadius = 16
        playerContainer.layer.borderWidth = 1
        playerContainer.layer.borderColor = UIColor(red: 51.0 / 255.0, green: 65.0 / 255.0, blue: 85.0 / 255.0, alpha: 1.0).cgColor
        playerContainer.clipsToBounds = true
        playerContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(playerContainer)

        addChild(playerVC)
        playerVC.view.translatesAutoresizingMaskIntoConstraints = false
        playerVC.showsPlaybackControls = true
        playerContainer.addSubview(playerVC.view)
        playerVC.didMove(toParent: self)

        let ocrCard = UIView()
        ocrCard.backgroundColor = UIColor(red: 17.0 / 255.0, green: 24.0 / 255.0, blue: 39.0 / 255.0, alpha: 1.0)
        ocrCard.layer.cornerRadius = 16
        ocrCard.layer.borderWidth = 1
        ocrCard.layer.borderColor = UIColor(red: 20.0 / 255.0, green: 184.0 / 255.0, blue: 166.0 / 255.0, alpha: 1.0).cgColor
        ocrCard.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(ocrCard)

        let ocrHeader = UIStackView()
        ocrHeader.axis = .horizontal
        ocrHeader.alignment = .center
        ocrHeader.spacing = 8
        ocrHeader.translatesAutoresizingMaskIntoConstraints = false

        ocrTitleLabel.text = "📝 영상 화면 속 한글 자동 추출"
        ocrTitleLabel.textColor = UIColor(red: 94.0 / 255.0, green: 234.0 / 255.0, blue: 212.0 / 255.0, alpha: 1.0)
        ocrTitleLabel.font = UIFont.boldSystemFont(ofSize: 13.5)

        copyAllButton.setTitle("📋 전체 복사", for: .normal)
        copyAllButton.setTitleColor(UIColor(red: 15.0 / 255.0, green: 23.0 / 255.0, blue: 42.0 / 255.0, alpha: 1.0), for: .normal)
        copyAllButton.titleLabel?.font = UIFont.boldSystemFont(ofSize: 12.0)
        copyAllButton.backgroundColor = UIColor(red: 45.0 / 255.0, green: 212.0 / 255.0, blue: 191.0 / 255.0, alpha: 1.0)
        copyAllButton.layer.cornerRadius = 13
        copyAllButton.contentEdgeInsets = UIEdgeInsets(top: 5, left: 11, bottom: 5, right: 11)
        copyAllButton.isHidden = true
        copyAllButton.setContentHuggingPriority(.required, for: .horizontal)
        copyAllButton.addTarget(self, action: #selector(handleCopyAllTapped), for: .touchUpInside)

        ocrHeader.addArrangedSubview(ocrTitleLabel)
        ocrHeader.addArrangedSubview(copyAllButton)
        ocrCard.addSubview(ocrHeader)

        let ocrScroll = UIScrollView()
        ocrScroll.translatesAutoresizingMaskIntoConstraints = false
        linesStack.axis = .vertical
        linesStack.spacing = 6
        linesStack.translatesAutoresizingMaskIntoConstraints = false
        ocrScroll.addSubview(linesStack)
        ocrCard.addSubview(ocrScroll)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),

            playerContainer.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 10),
            playerContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            playerContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),

            playerVC.view.topAnchor.constraint(equalTo: playerContainer.topAnchor),
            playerVC.view.bottomAnchor.constraint(equalTo: playerContainer.bottomAnchor),
            playerVC.view.leadingAnchor.constraint(equalTo: playerContainer.leadingAnchor),
            playerVC.view.trailingAnchor.constraint(equalTo: playerContainer.trailingAnchor),

            ocrCard.topAnchor.constraint(equalTo: playerContainer.bottomAnchor, constant: 12),
            ocrCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            ocrCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            ocrCard.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            ocrCard.heightAnchor.constraint(lessThanOrEqualTo: view.heightAnchor, multiplier: 0.32),
            ocrCard.heightAnchor.constraint(greaterThanOrEqualToConstant: 96),

            ocrHeader.topAnchor.constraint(equalTo: ocrCard.topAnchor, constant: 11),
            ocrHeader.leadingAnchor.constraint(equalTo: ocrCard.leadingAnchor, constant: 12),
            ocrHeader.trailingAnchor.constraint(equalTo: ocrCard.trailingAnchor, constant: -12),

            ocrScroll.topAnchor.constraint(equalTo: ocrHeader.bottomAnchor, constant: 8),
            ocrScroll.leadingAnchor.constraint(equalTo: ocrCard.leadingAnchor, constant: 12),
            ocrScroll.trailingAnchor.constraint(equalTo: ocrCard.trailingAnchor, constant: -12),
            ocrScroll.bottomAnchor.constraint(equalTo: ocrCard.bottomAnchor, constant: -11),

            linesStack.topAnchor.constraint(equalTo: ocrScroll.contentLayoutGuide.topAnchor),
            linesStack.bottomAnchor.constraint(equalTo: ocrScroll.contentLayoutGuide.bottomAnchor),
            linesStack.leadingAnchor.constraint(equalTo: ocrScroll.contentLayoutGuide.leadingAnchor),
            linesStack.trailingAnchor.constraint(equalTo: ocrScroll.contentLayoutGuide.trailingAnchor),
            linesStack.widthAnchor.constraint(equalTo: ocrScroll.frameLayoutGuide.widthAnchor)
        ])

        startDirectHardwarePlayback()
        renderOcrState()
        if currentOcrResult == nil {
            GhostiMobileCarePlugin.extractIosVideoNativeOcrInternal(localId: localId, maxFrames: 8) { [weak self] extracted in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    self.currentOcrResult = extracted
                    self.renderOcrState()
                }
            }
        }
    }

    private func startDirectHardwarePlayback() {
        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
        guard let asset = fetched.firstObject else { return }
        let pOpts = PHVideoRequestOptions()
        pOpts.isNetworkAccessAllowed = true
        pOpts.deliveryMode = .automatic
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])
        try? AVAudioSession.sharedInstance().setActive(true)
        PHImageManager.default().requestPlayerItem(forVideo: asset, options: pOpts) { [weak self] playerItem, _ in
            guard let self = self, let item = playerItem else { return }
            DispatchQueue.main.async {
                let player = AVPlayer(playerItem: item)
                self.playerVC.player = player
                if self.initialSeekSec > 0 {
                    let target = CMTime(seconds: Double(self.initialSeekSec), preferredTimescale: 600)
                    player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { _ in
                        player.play()
                    }
                } else {
                    player.play()
                }
            }
        }
    }

    private func renderOcrState() {
        for sub in linesStack.arrangedSubviews {
            linesStack.removeArrangedSubview(sub)
            sub.removeFromSuperview()
        }
        lineTimeSecs.removeAll()
        lineTexts.removeAll()

        guard let cur = currentOcrResult else {
            copyAllButton.isHidden = true
            let loadingLbl = UILabel()
            loadingLbl.text = "🔍 온디바이스 AI가 영상 화면 속 한글을 빠르게 읽고 있습니다..."
            loadingLbl.textColor = UIColor(red: 226.0 / 255.0, green: 232.0 / 255.0, blue: 240.0 / 255.0, alpha: 1.0)
            loadingLbl.font = UIFont.systemFont(ofSize: 13.0)
            loadingLbl.numberOfLines = 0
            linesStack.addArrangedSubview(loadingLbl)
            return
        }

        if !cur.hasText || cur.lines.isEmpty {
            copyAllButton.isHidden = true
            let emptyLbl = UILabel()
            emptyLbl.text = "이 영상 화면에서는 인식된 글자가 없습니다."
            emptyLbl.textColor = UIColor(red: 148.0 / 255.0, green: 163.0 / 255.0, blue: 184.0 / 255.0, alpha: 1.0)
            emptyLbl.font = UIFont.systemFont(ofSize: 13.0)
            emptyLbl.numberOfLines = 0
            linesStack.addArrangedSubview(emptyLbl)
            return
        }

        ocrTitleLabel.text = "📝 추출된 화면 한글 (\(cur.lines.count)구간 · 터치 시 구간 이동·복사)"
        copyAllButton.isHidden = false
        for (idx, entry) in cur.lines.enumerated() {
            lineTimeSecs.append(entry.timeSec)
            lineTexts.append(entry.text)

            let btn = UIButton(type: .system)
            btn.tag = idx
            btn.contentHorizontalAlignment = .leading
            btn.titleLabel?.numberOfLines = 0
            btn.titleLabel?.font = UIFont.systemFont(ofSize: 13.5, weight: .medium)
            btn.setTitle("[\(entry.timestamp)]  \(entry.text)", for: .normal)
            btn.setTitleColor(UIColor(red: 248.0 / 255.0, green: 250.0 / 255.0, blue: 252.0 / 255.0, alpha: 1.0), for: .normal)
            btn.backgroundColor = UIColor(red: 30.0 / 255.0, green: 41.0 / 255.0, blue: 59.0 / 255.0, alpha: 1.0)
            btn.layer.cornerRadius = 10
            btn.contentEdgeInsets = UIEdgeInsets(top: 8, left: 10, bottom: 8, right: 10)
            btn.addTarget(self, action: #selector(handleLineTapped(_:)), for: .touchUpInside)
            linesStack.addArrangedSubview(btn)
        }
    }

    @objc private func handleLineTapped(_ sender: UIButton) {
        let idx = sender.tag
        guard idx >= 0 && idx < lineTexts.count else { return }
        let sec = lineTimeSecs[idx]
        let txt = lineTexts[idx]
        if let player = playerVC.player {
            let cm = CMTime(seconds: Double(max(0, sec)), preferredTimescale: 600)
            player.seek(to: cm, toleranceBefore: .zero, toleranceAfter: .zero) { _ in
                player.play()
            }
        }
        UIPasteboard.general.string = txt
        ocrTitleLabel.text = "✅ 구간 이동 및 문장 복사 완료!"
    }

    @objc private func handleCopyAllTapped() {
        guard !lineTexts.isEmpty else { return }
        UIPasteboard.general.string = lineTexts.joined(separator: "\n")
        copyAllButton.setTitle("✅ 복사됨", for: .normal)
    }

    @objc private func handleCloseTapped() {
        playerVC.player?.pause()
        playerVC.player = nil
        dismiss(animated: true) { [weak self] in
            guard let self = self, !self.didInvokeDismiss else { return }
            self.didInvokeDismiss = true
            self.onDismissCallback(self.currentOcrResult)
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed && !didInvokeDismiss {
            playerVC.player?.pause()
            playerVC.player = nil
            didInvokeDismiss = true
            onDismissCallback(currentOcrResult)
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    private func recordAndDispatchIncomingUrl(_ url: URL?) {
        guard let url = url else { return }
        let urlStr = url.absoluteString
        let lower = urlStr.lowercased()
        guard lower.hasPrefix("ghosti://")
            || lower.contains("invite=")
            || lower.contains("invitetoken=")
            || lower.contains("workroom=")
            || lower.contains("paircode=") else { return }
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

    func sceneDidBecomeActive(_ scene: UIScene) {
        DispatchQueue.main.async { [weak self] in
            guard let bridgeVC = self?.window?.rootViewController as? GhostiBridgeViewController else { return }
            let js = "window.dispatchEvent(new CustomEvent('ghostiNativeAppResumed', { detail: { hasWindowFocus: true, platform: 'ios' } }));"
            bridgeVC.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
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
