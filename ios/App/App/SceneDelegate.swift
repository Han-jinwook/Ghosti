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

        // [대안 B · 구글 포토 iOS / 애플 순정 표준]
        // 애플 PhotoKit은 FaceID로 잠긴 『최근 삭제된 항목』에서 외부 앱이 사진을 꺼내오는(Undelete) API를 보안 정책상 제공하지 않으므로,
        // 앱 캐시 사본 백업이나 중복 사본 생성을 하지 않고 아이폰 순정 『사진 ➔ 최근 삭제된 항목(FaceID)』 복원 안내로 일원화합니다.
        if action.lowercased() == "restore" {
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
