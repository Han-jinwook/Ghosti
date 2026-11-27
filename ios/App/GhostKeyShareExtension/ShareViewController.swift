import UIKit
import UniformTypeIdentifiers

/// [Ghosti 3귀신] iOS 초경량 무화면 직송 공유 익스텐션 ([공유...] ➔ [귀신같이] 2탭 종결)
/// - 거대한 전체화면 검은 시트 대신 하단 78pt 초소형 미니 시트(iOS 16+ Detent) + 0ms 즉시 전송 착수로
///   앱 화면 오픈 없이([붙여넣기 허용] 팝업 0회) 선택한 순수 글자·링크·사진을 초고속 직송 후 즉시 닫힙니다.
class ShareViewController: UIViewController {
    private var didStart = false
    private let cardView = UIView()
    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        preferredContentSize = CGSize(width: 260, height: 68)
        view.backgroundColor = .clear
        view.isOpaque = false

        cardView.translatesAutoresizingMaskIntoConstraints = false
        cardView.backgroundColor = UIColor(white: 0.12, alpha: 0.92)
        cardView.layer.cornerRadius = 16
        cardView.layer.masksToBounds = true
        view.addSubview(cardView)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.text = "💻 PC(Ctrl+V)로 바로 전송 중…"
        statusLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        statusLabel.textColor = .white
        statusLabel.textAlignment = .center
        cardView.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            cardView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cardView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            cardView.heightAnchor.constraint(equalToConstant: 36),
            cardView.widthAnchor.constraint(greaterThanOrEqualToConstant: 208),
            statusLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
            statusLabel.centerYAnchor.constraint(equalTo: cardView.centerYAnchor)
        ])

        applyCompactSheetDetentIfPossible()
        // 모달 애니메이션이 끝나길 기다리지 않고(viewDidAppear 약 0.55초 지연 제거) 0ms에 TLS 연결 예열 및 전송 즉시 착수!
        GhostKeySharedClipboardStore.prewarmBridgeConnection()
        didStart = true
        extractAndDispatchSharedItems()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        applyCompactSheetDetentIfPossible()
        clearHostSheetBackgrounds()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        clearHostSheetBackgrounds()
    }

    private func applyCompactSheetDetentIfPossible() {
        if #available(iOS 16.0, *) {
            let compactDetent = UISheetPresentationController.Detent.custom(identifier: .init("ghosti_compact")) { _ in
                return 78.0
            }
            let candidates: [UISheetPresentationController?] = [
                self.sheetPresentationController,
                self.parent?.sheetPresentationController,
                self.navigationController?.sheetPresentationController
            ]
            for cand in candidates {
                if let sheet = cand {
                    sheet.detents = [compactDetent]
                    sheet.prefersGrabberVisible = false
                    sheet.preferredCornerRadius = 20
                }
            }
        }
    }

    private func clearHostSheetBackgrounds() {
        var cur: UIView? = view
        var hops = 0
        while let v = cur, hops < 5 {
            v.backgroundColor = .clear
            v.isOpaque = false
            cur = v.superview
            hops += 1
        }
    }

    private static func sanitizeWebSelectionText(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.range(of: #"^https?://\S+$"#, options: .regularExpression) != nil {
            return trimmed
        }
        if let regex = try? NSRegularExpression(pattern: #"^(?s)(.+?)(?:\r?\n\s*|\s+)(https?://\S+)\s*$"#) {
            let ns = trimmed as NSString
            if let match = regex.firstMatch(in: trimmed, range: NSRange(location: 0, length: ns.length)),
               match.numberOfRanges >= 3 {
                var bodyPart = ns.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
                let urlPart = ns.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespacesAndNewlines)
                let sepStart = match.range(at: 1).location + match.range(at: 1).length
                let sepLen = max(0, match.range(at: 2).location - sepStart)
                let sepStr = ns.substring(with: NSRange(location: sepStart, length: sepLen))
                let isHighlight = urlPart.contains("#:~:text=")
                let hasNewline = sepStr.contains("\n")
                if !bodyPart.isEmpty,
                   bodyPart.range(of: #"^https?://\S+$"#, options: .regularExpression) == nil,
                   (isHighlight || hasNewline) {
                    if (bodyPart.hasPrefix("\"") && bodyPart.hasSuffix("\"") && bodyPart.count >= 2)
                        || (bodyPart.hasPrefix("“") && bodyPart.hasSuffix("”") && bodyPart.count >= 2) {
                        bodyPart = String(bodyPart.dropFirst().dropLast()).trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                    if !bodyPart.isEmpty {
                        return bodyPart
                    }
                }
            }
        }
        return trimmed
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
                self.statusLabel.text = "🖼️ 사진을 PC(Ctrl+V)로 전송 중…"
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
                self?.statusLabel.text = anyOk ? "✅ PC 전송 완료!" : "⚠️ 앱 로그인 확인 필요"
                self?.finishNow()
            }
            return
        }

        // 2순위: 드래그한 글자(텍스트) 무화면 초고속 직송 (인공 지연 0ms 즉시 종료)
        if let tp = textProvider {
            tp.loadItem(forTypeIdentifier: plainType, options: nil) { [weak self] data, _ in
                let rawExtracted: String = {
                    if let s = data as? String { return s }
                    if let u = data as? URL { return u.absoluteString }
                    if let d = data as? Data, let s = String(data: d, encoding: .utf8) { return s }
                    return ""
                }()
                let extracted = ShareViewController.sanitizeWebSelectionText(rawExtracted)
                guard !extracted.isEmpty else {
                    DispatchQueue.main.async { self?.finishNow() }
                    return
                }
                GhostKeySharedClipboardStore.pushClipDirect(extracted, senderName: "내 아이폰 (PC로 보내기)") { _ in
                    DispatchQueue.main.async {
                        self?.finishNow()
                    }
                }
            }
            return
        }

        // 3순위: 웹/사파리 URL 단독 무화면 직송
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
                GhostKeySharedClipboardStore.pushClipDirect(urlStr, senderName: "내 아이폰 (링크 직송)") { _ in
                    DispatchQueue.main.async {
                        self?.finishNow()
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

            let maxSide: CGFloat = 2200.0
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

            guard let jpegData = rendered.jpegData(compressionQuality: 0.86) else {
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
