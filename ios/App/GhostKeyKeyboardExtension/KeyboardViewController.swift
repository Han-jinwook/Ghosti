import UIKit

/// [Ghosti 3귀신] iOS 앱 미진입 입력창 직결 정공법 — GhostKey 7일 클립보드 키보드 익스텐션
/// - 카톡·사파리·메모장 등 어느 입력창에서든 지구본(🌐) 전환 1번으로
///   PC+폰 통합 7일 치 클립보드를 본체 앱 실행 없이 직통 수신·터치 즉시 커서에 입력(textDocumentProxy.insertText)합니다.
/// - 1→2→3 순차 붙여넣기 및 키보드 활성 중 복사 즉시 감지·PC E2EE 직통 발송을 지원합니다.
class KeyboardViewController: UIInputViewController {
    private let stackView = UIStackView()
    private let titleLabel = UILabel()
    private var lastPasteboardChangeCount: Int = -1

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.97, green: 0.98, blue: 0.99, alpha: 1.0)
        buildLayout()
        capturePasteboardIfChanged()
        reloadClipList()
        GhostKeySharedClipboardStore.pullRemoteAsync(force: true) { [weak self] in
            self?.reloadClipList()
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        capturePasteboardIfChanged()
        reloadClipList()
        GhostKeySharedClipboardStore.pullRemoteAsync(force: false) { [weak self] in
            self?.reloadClipList()
        }
    }

    private func buildLayout() {
        let topBar = UIStackView()
        topBar.axis = .horizontal
        topBar.alignment = .center
        topBar.spacing = 5
        topBar.translatesAutoresizingMaskIntoConstraints = false
        topBar.layoutMargins = UIEdgeInsets(top: 8, left: 10, bottom: 8, right: 10)
        topBar.isLayoutMarginsRelativeArrangement = true
        topBar.backgroundColor = .white

        titleLabel.text = "귀신 7일 클립보드"
        titleLabel.font = .boldSystemFont(ofSize: 12.5)
        titleLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        topBar.addArrangedSubview(titleLabel)

        let seqBtn = makeChipButton(title: "1→2→3", bg: UIColor(red: 0.05, green: 0.58, blue: 0.53, alpha: 1.0), fg: .white)
        seqBtn.addTarget(self, action: #selector(handleSequentialPaste), for: .touchUpInside)
        topBar.addArrangedSubview(seqBtn)

        let captureBtn = makeChipButton(title: "복사 담기", bg: UIColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1.0), fg: .darkGray)
        captureBtn.addTarget(self, action: #selector(handleManualCapture), for: .touchUpInside)
        topBar.addArrangedSubview(captureBtn)

        let syncBtn = makeChipButton(title: "동기화", bg: UIColor(red: 0.90, green: 0.97, blue: 0.96, alpha: 1.0), fg: UIColor(red: 0.04, green: 0.45, blue: 0.41, alpha: 1.0))
        syncBtn.addTarget(self, action: #selector(handleManualSync), for: .touchUpInside)
        topBar.addArrangedSubview(syncBtn)

        let nextKbBtn = makeChipButton(title: "🌐", bg: UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0), fg: .black)
        nextKbBtn.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        nextKbBtn.addTarget(self, action: #selector(handleAdvanceKeyboard), for: .touchUpInside)
        topBar.addArrangedSubview(nextKbBtn)

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false

        stackView.axis = .vertical
        stackView.spacing = 6
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stackView)

        view.addSubview(topBar)
        view.addSubview(scroll)

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            scroll.topAnchor.constraint(equalTo: topBar.bottomAnchor, constant: 4),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -8),
            scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 210),

            stackView.topAnchor.constraint(equalTo: scroll.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: scroll.bottomAnchor),
            stackView.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])
    }

    private func makeChipButton(title: String, bg: UIColor, fg: UIColor) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.setTitleColor(fg, for: .normal)
        btn.titleLabel?.font = .boldSystemFont(ofSize: 11.5)
        btn.backgroundColor = bg
        btn.layer.cornerRadius = 8
        btn.contentEdgeInsets = UIEdgeInsets(top: 6, left: 8, bottom: 6, right: 8)
        return btn
    }

    private func capturePasteboardIfChanged() {
        guard hasFullAccess else { return }
        let pb = UIPasteboard.general
        guard pb.changeCount != lastPasteboardChangeCount else { return }
        lastPasteboardChangeCount = pb.changeCount
        guard pb.hasStrings, let txt = pb.string, !txt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        GhostKeySharedClipboardStore.pushLocalClip(txt, senderName: "내 아이폰")
    }

    @objc private func handleManualCapture() {
        lastPasteboardChangeCount = -1
        capturePasteboardIfChanged()
        reloadClipList()
    }

    @objc private func handleManualSync() {
        capturePasteboardIfChanged()
        GhostKeySharedClipboardStore.pullRemoteAsync(force: true) { [weak self] in
            self?.reloadClipList()
        }
    }

    @objc private func handleSequentialPaste() {
        if let (_, entry) = GhostKeySharedClipboardStore.nextSequentialEntry() {
            textDocumentProxy.insertText(entry.text)
        }
    }

    @objc private func handleAdvanceKeyboard() {
        advanceToNextInputMode()
    }

    private func reloadClipList() {
        stackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let items = GhostKeySharedClipboardStore.loadHistory()
        titleLabel.text = "귀신 클립보드 (\(items.count))"

        if !hasFullAccess {
            let notice = UILabel()
            notice.text = "아이폰 설정 → 일반 → 키보드 → 키보드 → '귀신 7일 클립보드'에서 '전체 접근 허용'을 켜주시면 PC와 실시간 연동됩니다."
            notice.numberOfLines = 0
            notice.textAlignment = .center
            notice.font = .systemFont(ofSize: 12)
            notice.textColor = UIColor(red: 0.04, green: 0.45, blue: 0.41, alpha: 1.0)
            stackView.addArrangedSubview(notice)
        }

        if items.isEmpty {
            let empty = UILabel()
            empty.text = "PC나 아이폰에서 복사한 글이 7일간 여기에 보관됩니다.\n터치 한 번으로 현재 입력창에 바로 붙여넣을 수 있습니다."
            empty.numberOfLines = 0
            empty.textAlignment = .center
            empty.font = .systemFont(ofSize: 12.5)
            empty.textColor = .gray
            stackView.addArrangedSubview(empty)
            return
        }

        for (idx, item) in items.prefix(60).enumerated() {
            let btn = UIButton(type: .system)
            btn.backgroundColor = .white
            btn.layer.cornerRadius = 10
            btn.layer.borderWidth = 1
            btn.layer.borderColor = UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0).cgColor
            btn.contentHorizontalAlignment = .left
            btn.contentEdgeInsets = UIEdgeInsets(top: 8, left: 10, bottom: 8, right: 10)
            btn.titleLabel?.numberOfLines = 2
            btn.titleLabel?.font = .systemFont(ofSize: 13)
            btn.setTitleColor(UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0), for: .normal)
            btn.setTitle("#\(idx + 1) [\(item.senderName)] \(item.text)", for: .normal)
            btn.tag = idx
            btn.addTarget(self, action: #selector(handleTapClipItem(_:)), for: .touchUpInside)
            stackView.addArrangedSubview(btn)
        }
    }

    @objc private func handleTapClipItem(_ sender: UIButton) {
        let items = GhostKeySharedClipboardStore.loadHistory()
        guard sender.tag >= 0 && sender.tag < items.count else { return }
        textDocumentProxy.insertText(items[sender.tag].text)
    }
}
