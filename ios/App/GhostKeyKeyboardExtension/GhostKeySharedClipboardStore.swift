import Foundation
import CryptoKit

/// [Ghosti 3귀신] iOS App Group 공용 7일(168시간) · 최대 500건 클립보드 저장소
/// - App Group ID: group.app.sundreamer.ghosti
/// - 본체 앱, GhostKeyKeyboardExtension(키보드), GhostKeyShareExtension(공유 시트) 3곳이 실시간 공유합니다.
struct GhostKeyClipEntry: Codable {
    let clipHash: String
    let text: String
    let senderName: String
    let createdAt: String
    let createdAtMs: Double
}

final class GhostKeySharedClipboardStore {
    static let appGroupId = "group.app.sundreamer.ghosti"
    static let retentionMs: Double = 7 * 24 * 3600 * 1000
    static let maxItems = 500

    private static let keyHistory = "ghosti_shared_clipboard_history_v1"
    private static let keyPendingOutbound = "ghosti_shared_clipboard_pending_outbound_v1"
    private static let keySeqIndex = "ghosti_shared_clipboard_seq_index_v1"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func sha256Hex(_ text: String) -> String {
        let digest = SHA256.hash(data: Data(text.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    static func loadHistory() -> [GhostKeyClipEntry] {
        guard let raw = defaults?.data(forKey: keyHistory),
              let decoded = try? JSONDecoder().decode([GhostKeyClipEntry].self, from: raw) else {
            return []
        }
        let cutoff = Date().timeIntervalSince1970 * 1000 - retentionMs
        var seen = Set<String>()
        var result: [GhostKeyClipEntry] = []
        for item in decoded {
            let trimmed = item.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            if item.createdAtMs > 0 && item.createdAtMs < cutoff { continue }
            if seen.insert(item.clipHash).inserted {
                result.append(item)
                if result.count >= maxItems { break }
            }
        }
        return result
    }

    @discardableResult
    static func pushLocalClip(_ rawText: String, senderName: String = "내 아이폰") -> GhostKeyClipEntry? {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let clipped = String(trimmed.prefix(16000))
        let nowMs = Date().timeIntervalSince1970 * 1000
        let iso = ISO8601DateFormatter().string(from: Date())
        let hash = sha256Hex(clipped)
        let entry = GhostKeyClipEntry(
            clipHash: hash,
            text: clipped,
            senderName: senderName,
            createdAt: iso,
            createdAtMs: nowMs
        )

        var merged = [entry] + loadHistory().filter { $0.clipHash != hash }
        if merged.count > maxItems { merged = Array(merged.prefix(maxItems)) }
        if let encoded = try? JSONEncoder().encode(merged) {
            defaults?.set(encoded, forKey: keyHistory)
        }
        defaults?.set(0, forKey: keySeqIndex)

        var pending = loadPendingOutbound().filter { $0.clipHash != hash }
        pending.insert(entry, at: 0)
        if pending.count > 60 { pending = Array(pending.prefix(60)) }
        if let pEnc = try? JSONEncoder().encode(pending) {
            defaults?.set(pEnc, forKey: keyPendingOutbound)
        }
        defaults?.synchronize()
        return entry
    }

    static func loadPendingOutbound() -> [GhostKeyClipEntry] {
        guard let raw = defaults?.data(forKey: keyPendingOutbound),
              let decoded = try? JSONDecoder().decode([GhostKeyClipEntry].self, from: raw) else {
            return []
        }
        return decoded
    }

    static func nextSequentialEntry() -> (Int, GhostKeyClipEntry)? {
        let items = loadHistory()
        guard !items.isEmpty else { return nil }
        let saved = defaults?.integer(forKey: keySeqIndex) ?? 0
        let idx = (saved >= 0 && saved < items.count) ? saved : 0
        defaults?.set((idx + 1) % items.count, forKey: keySeqIndex)
        return (idx, items[idx])
    }
}
