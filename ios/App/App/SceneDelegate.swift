import UIKit
import WebKit
import Capacitor
import Photos
import PhotosUI
import AVFoundation

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
        CAPPluginMethod(name: "setNativeThemeMode", returnType: CAPPluginReturnPromise)
    ]

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
                            if let img = uiImg, let jpeg = img.jpegData(compressionQuality: 0.78) {
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

        let filePrefix = forceTranscode ? "ghosti_vid_h264_" : "ghosti_vid_"
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

            if !forceTranscode,
               let urlAsset = compAsset as? AVURLAsset,
               urlAsset.url.pathExtension.lowercased() == "mp4" {
                try? fm.removeItem(at: outUrl)
                if (try? fm.copyItem(at: urlAsset.url, to: outUrl)) != nil,
                   let attrs = try? fm.attributesOfItem(atPath: outUrl.path),
                   let sz = attrs[.size] as? NSNumber,
                   sz.int64Value > 4096 {
                    call.resolve(["ok": true, "fileUrl": outUrl.path])
                    return
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

    @objc func extractVideoKeyframes(_ call: CAPPluginCall) {
        let rawId = call.getString("id") ?? ""
        let maxFrames = max(1, min(10, call.getInt("maxFrames") ?? 6))
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
                let count = durSec <= 2.2 ? 2 : (durSec <= 6.0 ? min(4, maxFrames) : maxFrames)
                let generator = AVAssetImageGenerator(asset: compAsset)
                generator.appliesPreferredTrackTransform = true
                generator.maximumSize = CGSize(width: 1280, height: 1280)
                let tol = CMTime(seconds: durSec <= 12.0 ? 0.15 : 0.35, preferredTimescale: 600)
                generator.requestedTimeToleranceBefore = tol
                generator.requestedTimeToleranceAfter = tol

                var framesList: [[String: Any]] = []
                for i in 0..<count {
                    let ratio = count == 1 ? 0.3 : (Double(i) + 0.35) / Double(count)
                    let tSec = max(0.05, min(durSec - 0.05, durSec * ratio))
                    let cmTime = CMTime(seconds: tSec, preferredTimescale: 600)
                    if let cgImg = try? generator.copyCGImage(at: cmTime, actualTime: nil) {
                        let uiImg = UIImage(cgImage: cgImg)
                        if let jpeg = uiImg.jpegData(compressionQuality: 0.82) {
                            framesList.append([
                                "timeSec": Int(round(tSec)),
                                "dataUrl": "data:image/jpeg;base64," + jpeg.base64EncodedString()
                            ])
                        }
                    }
                }
                call.resolve([
                    "ok": !framesList.isEmpty,
                    "frames": framesList
                ])
            }
        }
    }

    private func iosTrashVaultDirectory() -> URL {
        let fm = FileManager.default
        let base = fm.urls(for: .cachesDirectory, in: .userDomainMask).first ?? fm.temporaryDirectory
        let dir = base.appendingPathComponent("ghosti_ios_trash_vault", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private func safeVaultStem(_ rawId: String) -> String {
        return rawId
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
            .replacingOccurrences(of: " ", with: "_")
    }

    private func decodeDataUrlToImage(_ dataUrl: String) -> UIImage? {
        guard !dataUrl.isEmpty else { return nil }
        if let commaRange = dataUrl.range(of: ",") {
            let b64 = String(dataUrl[commaRange.upperBound...])
            if let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) {
                return UIImage(data: data)
            }
        }
        return nil
    }

    @objc func requestSystemPhotoTrash(_ call: CAPPluginCall) {
        let action = call.getString("action") ?? "move"
        let items = call.getArray("items", JSObject.self) ?? []
        var requestedIds: [String] = []
        var assetIds: [String] = []
        var thumbById: [String: String] = [:]
        var mtimeById: [String: Double] = [:]

        for obj in items {
            let idVal = (obj["id"] as? String) ?? ""
            let nameVal = (obj["name"] as? String) ?? ""
            let thumbVal = (obj["thumbDataUrl"] as? String) ?? ""
            let mtimeMs = (obj["mtimeMs"] as? Double) ?? 0.0
            if !idVal.isEmpty {
                requestedIds.append(idVal)
                if !thumbVal.isEmpty {
                    thumbById[idVal] = thumbVal
                }
                if mtimeMs > 0 {
                    mtimeById[idVal] = mtimeMs / 1000.0
                }
                if idVal.contains("/") {
                    assetIds.append(idVal)
                }
            } else if !nameVal.isEmpty {
                requestedIds.append(nameVal)
            }
        }

        let vaultDir = iosTrashVaultDirectory()
        let fm = FileManager.default

        if action.lowercased() == "restore" {
            DispatchQueue.global(qos: .userInitiated).async {
                var restorePayloads: [(oldId: String, image: UIImage, creationDate: Date?, imgPath: URL, metaPath: URL)] = []
                for reqId in requestedIds {
                    let stem = self.safeVaultStem(reqId)
                    let imgUrl = vaultDir.appendingPathComponent("\(stem).img")
                    let metaUrl = vaultDir.appendingPathComponent("\(stem).meta")
                    var restoredImage: UIImage? = nil
                    if fm.fileExists(atPath: imgUrl.path),
                       let data = try? Data(contentsOf: imgUrl),
                       let uiImg = UIImage(data: data) {
                        restoredImage = uiImg
                    } else if let fbThumb = thumbById[reqId],
                              let uiImg = self.decodeDataUrlToImage(fbThumb) {
                        restoredImage = uiImg
                    }
                    if let finalImg = restoredImage {
                        var cDate: Date? = nil
                        if fm.fileExists(atPath: metaUrl.path),
                           let metaStr = try? String(contentsOf: metaUrl, encoding: .utf8),
                           let ts = Double(metaStr.trimmingCharacters(in: .whitespacesAndNewlines)),
                           ts > 0 {
                            cDate = Date(timeIntervalSince1970: ts)
                        } else if let fallbackTs = mtimeById[reqId], fallbackTs > 0 {
                            cDate = Date(timeIntervalSince1970: fallbackTs)
                        }
                        restorePayloads.append((oldId: reqId, image: finalImg, creationDate: cDate, imgPath: imgUrl, metaPath: metaUrl))
                    }
                }

                if restorePayloads.isEmpty {
                    call.resolve([
                        "ok": true,
                        "action": "restore",
                        "canceled": false,
                        "matchedMediaStoreCount": 0,
                        "doneIds": requestedIds,
                        "replacedIds": [:]
                    ])
                    return
                }

                var replacedIds: [String: String] = [:]
                PHPhotoLibrary.shared().performChanges({
                    for item in restorePayloads {
                        let createReq = PHAssetChangeRequest.creationRequestForAsset(from: item.image)
                        if let cDate = item.creationDate {
                            createReq.creationDate = cDate
                        }
                        if let placeholder = createReq.placeholderForCreatedAsset {
                            replacedIds[item.oldId] = placeholder.localIdentifier
                        }
                    }
                }) { success, _ in
                    if success {
                        for item in restorePayloads {
                            try? fm.removeItem(at: item.imgPath)
                            try? fm.removeItem(at: item.metaPath)
                        }
                    }
                    call.resolve([
                        "ok": true,
                        "action": "restore",
                        "canceled": false,
                        "matchedMediaStoreCount": replacedIds.count,
                        "doneIds": requestedIds,
                        "replacedIds": success ? replacedIds : [:]
                    ])
                }
            }
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

        DispatchQueue.global(qos: .userInitiated).async {
            let imgOpts = PHImageRequestOptions()
            imgOpts.isSynchronous = true
            imgOpts.deliveryMode = .highQualityFormat
            imgOpts.isNetworkAccessAllowed = true

            for i in 0..<fetched.count {
                autoreleasepool {
                    let asset = fetched.object(at: i)
                    var rawData: Data? = nil
                    if #available(iOS 13, *) {
                        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: imgOpts) { data, _, _, _ in
                            rawData = data
                        }
                    }
                    if rawData == nil {
                        PHImageManager.default().requestImage(
                            for: asset,
                            targetSize: CGSize(width: 2048, height: 2048),
                            contentMode: .aspectFit,
                            options: imgOpts
                        ) { uiImg, _ in
                            if let img = uiImg {
                                rawData = img.jpegData(compressionQuality: 0.92)
                            }
                        }
                    }
                    if let d = rawData {
                        let stem = self.safeVaultStem(asset.localIdentifier)
                        let imgUrl = vaultDir.appendingPathComponent("\(stem).img")
                        try? d.write(to: imgUrl, options: .atomic)
                        if let cDate = asset.creationDate {
                            let metaUrl = vaultDir.appendingPathComponent("\(stem).meta")
                            try? "\(cDate.timeIntervalSince1970)".data(using: .utf8)?.write(to: metaUrl, options: .atomic)
                        }
                    }
                }
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
