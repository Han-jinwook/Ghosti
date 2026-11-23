import UIKit
import UniformTypeIdentifiers

/// [Ghosti 3귀신] iOS 공유 시트 익스텐션 — 읽기 모드 웹서핑/카톡에서 앱 전환 없이 7일 클립보드 누적
class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extractAndSaveSharedText()
    }

    private func extractAndSaveSharedText() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            finish()
            return
        }
        let plainType = UTType.plainText.identifier
        let urlType = UTType.url.identifier

        for item in items {
            guard let providers = item.attachments else { continue }
            for provider in providers {
                if provider.hasItemConformingToTypeIdentifier(plainType) {
                    provider.loadItem(forTypeIdentifier: plainType, options: nil) { [weak self] data, _ in
                        if let text = data as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            GhostKeySharedClipboardStore.pushLocalClip(text, senderName: "내 아이폰 (공유)")
                        }
                        DispatchQueue.main.async { self?.finish() }
                    }
                    return
                }
                if provider.hasItemConformingToTypeIdentifier(urlType) {
                    provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] data, _ in
                        if let url = data as? URL {
                            GhostKeySharedClipboardStore.pushLocalClip(url.absoluteString, senderName: "내 아이폰 (공유)")
                        }
                        DispatchQueue.main.async { self?.finish() }
                    }
                    return
                }
            }
        }
        finish()
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
