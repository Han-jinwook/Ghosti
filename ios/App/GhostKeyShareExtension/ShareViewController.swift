import UIKit
import UniformTypeIdentifiers

/// [Ghosti 3귀신] iOS 무화면 직송 공유 익스텐션 ([공유...] ➔ [귀신같이] 2탭 종결)
/// - 본체 귀신같이 앱을 열지 않고, [붙여넣기 허용] 팝업도 전혀 띄우지 않은 채
///   선택한 글자·링크·사진·스크린샷을 0.3초 만에 PC Ctrl+V로 직송한 뒤 자동 종료합니다.
class ShareViewController: UIViewController {
    private var didStart = false
    private let pillLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.clear

        pillLabel.translatesAutoresizingMaskIntoConstraints = false
        pillLabel.text = "💻 PC로 바로 보내는 중..."
        pillLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        pillLabel.textColor = UIColor.white
        pillLabel.backgroundColor = UIColor(white: 0.10, alpha: 0.88)
        pillLabel.textAlignment = .center
        pillLabel.layer.cornerRadius = 18
        pillLabel.layer.masksToBounds = true
        view.addSubview(pillLabel)

        NSLayoutConstraint.activate([
            pillLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            pillLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            pillLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 210),
            pillLabel.heightAnchor.constraint(equalToConstant: 36)
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didStart else { return }
        didStart = true
        extractAndDispatchSharedItems()
    }

    private func extractAndDispatchSharedItems() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            finishNow()
            return
        }
        let imageType = UTType.image.identifier
        let plainType = UTType.plainText.identifier
        let urlType = UTType.url.identifier

        var imageProviders: [NSItemProvider] = []
        var textProvider: NSItemProvider?
        var urlProvider: NSItemProvider?

        for item in items {
            guard let providers = item.attachments else { continue }
            for provider in providers {
                if provider.hasItemConformingToTypeIdentifier(imageType) {
                    if imageProviders.count < 5 {
                        imageProviders.append(provider)
                    }
                } else if textProvider == nil && provider.hasItemConformingToTypeIdentifier(plainType) {
                    textProvider = provider
                } else if urlProvider == nil && provider.hasItemConformingToTypeIdentifier(urlType) {
                    urlProvider = provider
                }
            }
        }

        // 1순위: 사진·스크린샷 공유 직송 (갤러리·카톡 [공유] ➔ [귀신같이] 2탭)
        if !imageProviders.isEmpty {
            DispatchQueue.main.async {
                self.pillLabel.text = "🖼️ 사진을 PC(Ctrl+V)로 보내는 중..."
            }
            let group = DispatchGroup()
            var anyOk = false
            for (idx, imgProv) in imageProviders.enumerated() {
                group.enter()
                loadAndSendSingleImage(provider: imgProv, index: idx) { ok in
                    if ok { anyOk = true }
                    group.leave()
                }
            }
            group.notify(queue: .main) { [weak self] in
                self?.pillLabel.text = anyOk ? "✅ PC(Ctrl+V) 전송 완료!" : "⚠️ 귀신같이 앱 로그인 확인 필요"
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                    self?.finishNow()
                }
            }
            return
        }

        // 2순위: 드래그한 글자(텍스트) 무화면 직송
        if let tp = textProvider {
            tp.loadItem(forTypeIdentifier: plainType, options: nil) { [weak self] data, _ in
                let extracted: String = {
                    if let s = data as? String { return s }
                    if let u = data as? URL { return u.absoluteString }
                    if let d = data as? Data, let s = String(data: d, encoding: .utf8) { return s }
                    return ""
                }().trimmingCharacters(in: .whitespacesAndNewlines)

                guard !extracted.isEmpty else {
                    DispatchQueue.main.async { self?.finishNow() }
                    return
                }
                GhostKeySharedClipboardStore.pushClipDirect(extracted, senderName: "내 아이폰 (PC로 보내기)") { ok in
                    DispatchQueue.main.async {
                        self?.pillLabel.text = ok ? "✅ PC(Ctrl+V) 전송 완료!" : "✅ 저장 완료"
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
                            self?.finishNow()
                        }
                    }
                }
            }
            return
        }

        // 3순위: 웹/사파리 URL 무화면 직송
        if let up = urlProvider {
            up.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] data, _ in
                let urlStr: String = {
                    if let u = data as? URL { return u.absoluteString }
                    if let s = data as? String { return s }
                    return ""
                }().trimmingCharacters(in: .whitespacesAndNewlines)

                guard !urlStr.isEmpty else {
                    DispatchQueue.main.async { self?.finishNow() }
                    return
                }
                GhostKeySharedClipboardStore.pushClipDirect(urlStr, senderName: "내 아이폰 (링크 직송)") { ok in
                    DispatchQueue.main.async {
                        self?.pillLabel.text = ok ? "✅ PC(Ctrl+V) 전송 완료!" : "✅ 저장 완료"
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
                            self?.finishNow()
                        }
                    }
                }
            }
            return
        }

        finishNow()
    }

    private func loadAndSendSingleImage(provider: NSItemProvider, index: Int, completion: @escaping (Bool) -> Void) {
        let imageType = UTType.image.identifier
        provider.loadItem(forTypeIdentifier: imageType, options: nil) { data, _ in
            var loadedImage: UIImage?
            var fileName = "iphone_photo_\(Int(Date().timeIntervalSince1970))_\(index + 1).jpg"

            if let url = data as? URL {
                fileName = url.lastPathComponent.isEmpty ? fileName : url.lastPathComponent
                if let rawData = try? Data(contentsOf: url) {
                    loadedImage = UIImage(data: rawData)
                }
            } else if let img = data as? UIImage {
                loadedImage = img
            } else if let rawData = data as? Data {
                loadedImage = UIImage(data: rawData)
            }

            guard let srcImg = loadedImage else {
                completion(false)
                return
            }

            let maxSide: CGFloat = 2560.0
            let origW = srcImg.size.width * srcImg.scale
            let origH = srcImg.size.height * srcImg.scale
            let curMax = max(origW, origH)
            let ratio = curMax > maxSide ? (maxSide / curMax) : 1.0
            let targetSize = CGSize(width: max(1, round(origW * ratio)), height: max(1, round(origH * ratio)))

            let fmt = UIGraphicsImageRendererFormat()
            fmt.scale = 1.0
            fmt.opaque = true
            let rendered = UIGraphicsImageRenderer(size: targetSize, format: fmt).image { _ in
                srcImg.draw(in: CGRect(origin: .zero, size: targetSize))
            }

            guard let jpegData = rendered.jpegData(compressionQuality: 0.90) else {
                completion(false)
                return
            }
            let baseStem = (fileName as NSString).deletingPathExtension
            let jpgName = "\(baseStem.isEmpty ? "iphone_share" : baseStem).jpg"

            GhostKeySharedClipboardStore.pushPhotoDirectToPc(
                imageData: jpegData,
                fileName: jpgName,
                mimeType: "image/jpeg",
                width: Int(targetSize.width),
                height: Int(targetSize.height),
                completion: completion
            )
        }
    }

    private func finishNow() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
