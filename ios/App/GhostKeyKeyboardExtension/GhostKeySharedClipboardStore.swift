import Foundation
import Security
import CryptoKit
import CommonCrypto

/// [Ghosti 3귀신] iOS Shared Keychain 공용 7일(168시간) 클립보드 저장소 + 앱 미진입 직결 E2EE 송수신 엔진
/// - Keychain Access Group: 7K5PPQDZ5L.app.sundreamer.ghosti (본체 App 및 GhostKeyKeyboardExtension 무결성 공유)
/// - 본체 앱을 열지 않은 상태에서도 [귀신 7일 클립보드] 키보드(🌐) 전환 즉시 PC 최신 복사본을 직접 복호화 수신하고,
///   아이폰에서 복사한 내용을 즉시 AES-256-GCM(PBKDF2 60,000회) 암호화하여 PC로 직통 전송합니다.
struct GhostKeyClipEntry: Codable {
    let clipHash: String
    let text: String
    let senderName: String
    let createdAt: String
    let createdAtMs: Double
}

struct GhostKeyClipboardAuthContext: Codable {
    var email: String
    var canonicalUserId: String
    var hubToken: String
    var deviceId: String
    var deviceName: String
    var bridgeUrl: String
}

final class GhostKeySharedClipboardStore {
    static let sharedAccessGroup = "7K5PPQDZ5L.app.sundreamer.ghosti"
    static let keychainService = "app.sundreamer.ghosti.sharedclip.v1"
    static let defaultBridgeUrl = "https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge"
    static let retentionMs: Double = 7 * 24 * 3600 * 1000
    static let maxKeychainItems = 120

    private static let keyHistory = "ghosti_shared_clipboard_history_v1"
    private static let keyPendingOutbound = "ghosti_shared_clipboard_pending_outbound_v1"
    private static let keySeqIndex = "ghosti_shared_clipboard_seq_index_v1"
    private static let keyAuthContext = "ghosti_shared_clipboard_auth_v1"

    private static let ioQueue = DispatchQueue(label: "app.sundreamer.ghosti.sharedclip.io", qos: .userInitiated)
    private static let keyLock = NSLock()
    private static var keyCache: [String: SymmetricKey] = [:]
    private static var lastPullAtMs: Double = 0

    // MARK: - Shared Keychain Low-Level Read/Write (Fallback for Simulator)
    private static func makeBaseQuery(account: String, useGroup: Bool) -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: account
        ]
        if useGroup {
            q[kSecAttrAccessGroup as String] = sharedAccessGroup
        }
        return q
    }

    private static func readSharedData(forAccount account: String) -> Data? {
        for useGroup in [true, false] {
            var q = makeBaseQuery(account: account, useGroup: useGroup)
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let st = SecItemCopyMatching(q as CFDictionary, &item)
            if st == errSecSuccess, let data = item as? Data {
                return data
            }
            if st != errSecMissingEntitlement {
                if useGroup { break }
            }
        }
        return UserDefaults.standard.data(forKey: account)
    }

    private static func writeSharedData(_ data: Data?, forAccount account: String) {
        for useGroup in [true, false] {
            let baseQ = makeBaseQuery(account: account, useGroup: useGroup)
            if let validData = data {
                let attrs: [String: Any] = [
                    kSecValueData as String: validData,
                    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
                ]
                var st = SecItemUpdate(baseQ as CFDictionary, attrs as CFDictionary)
                if st == errSecItemNotFound {
                    var addQ = baseQ
                    addQ[kSecValueData as String] = validData
                    addQ[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
                    st = SecItemAdd(addQ as CFDictionary, nil)
                }
                if st == errSecSuccess {
                    return
                }
                if st != errSecMissingEntitlement && useGroup {
                    break
                }
            } else {
                let st = SecItemDelete(baseQ as CFDictionary)
                if st == errSecSuccess || st == errSecItemNotFound {
                    if useGroup { break }
                }
            }
        }
        if let validData = data {
            UserDefaults.standard.set(validData, forKey: account)
        } else {
            UserDefaults.standard.removeObject(forKey: account)
        }
    }

    static func sha256Hex(_ text: String) -> String {
        let digest = SHA256.hash(data: Data(text.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    static func formatIsoUtcNow() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }

    static func parseIsoMs(_ iso: String) -> Double {
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f1.date(from: iso) {
            return d.timeIntervalSince1970 * 1000.0
        }
        let f2 = ISO8601DateFormatter()
        if let d2 = f2.date(from: iso) {
            return d2.timeIntervalSince1970 * 1000.0
        }
        return Date().timeIntervalSince1970 * 1000.0
    }

    // MARK: - Auth Context
    static func saveAuthContext(
        email: String,
        canonicalUserId: String,
        hubToken: String,
        deviceId: String,
        deviceName: String,
        bridgeUrl: String
    ) {
        let normEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normUid = canonicalUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        let normToken = hubToken.trimmingCharacters(in: .whitespacesAndNewlines)
        let normDevId = deviceId.trimmingCharacters(in: .whitespacesAndNewlines)
        let normDevName = deviceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "내 아이폰"
            : deviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normUrl = bridgeUrl.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("https://")
            ? bridgeUrl.trimmingCharacters(in: .whitespacesAndNewlines)
            : defaultBridgeUrl

        if normEmail.isEmpty || normToken.isEmpty {
            writeSharedData(nil, forAccount: keyAuthContext)
            return
        }
        let ctx = GhostKeyClipboardAuthContext(
            email: normEmail,
            canonicalUserId: normUid,
            hubToken: normToken,
            deviceId: normDevId.isEmpty ? "ios-keyboard-direct" : normDevId,
            deviceName: normDevName,
            bridgeUrl: normUrl
        )
        if let encoded = try? JSONEncoder().encode(ctx) {
            writeSharedData(encoded, forAccount: keyAuthContext)
        }
        if !normUid.isEmpty {
            ioQueue.async {
                _ = deriveSymmetricKey(email: normEmail, uid: normUid)
            }
        }
    }

    static func loadAuthContext() -> GhostKeyClipboardAuthContext? {
        guard let raw = readSharedData(forAccount: keyAuthContext),
              let decoded = try? JSONDecoder().decode(GhostKeyClipboardAuthContext.self, from: raw) else {
            return nil
        }
        return decoded
    }

    // MARK: - 7-Day History & Pending Outbound
    static func loadHistory() -> [GhostKeyClipEntry] {
        guard let raw = readSharedData(forAccount: keyHistory),
              let decoded = try? JSONDecoder().decode([GhostKeyClipEntry].self, from: raw) else {
            return []
        }
        let cutoff = Date().timeIntervalSince1970 * 1000.0 - retentionMs
        var seen = Set<String>()
        var result: [GhostKeyClipEntry] = []
        for item in decoded {
            let trimmed = item.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            if item.createdAtMs > 0 && item.createdAtMs < cutoff { continue }
            if seen.insert(item.clipHash).inserted {
                result.append(item)
                if result.count >= maxKeychainItems { break }
            }
        }
        return result
    }

    private static func saveHistory(_ items: [GhostKeyClipEntry]) {
        let compact = Array(items.prefix(maxKeychainItems)).map { it in
            GhostKeyClipEntry(
                clipHash: it.clipHash,
                text: it.text.count > 4000 ? String(it.text.prefix(4000)) : it.text,
                senderName: String(it.senderName.prefix(48)),
                createdAt: it.createdAt,
                createdAtMs: it.createdAtMs
            )
        }
        if let encoded = try? JSONEncoder().encode(compact) {
            writeSharedData(encoded, forKeyAccount: keyHistory)
        }
    }

    private static func writeSharedData(_ data: Data?, forKeyAccount account: String) {
        writeSharedData(data, forAccount: account)
    }

    static func mergeFromWebHistory(_ rawItems: [[String: Any]]) -> Int {
        var incoming: [GhostKeyClipEntry] = []
        for dict in rawItems {
            let txt = (dict["text"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !txt.isEmpty else { continue }
            let cHash = (dict["clipHash"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedHash = cHash.isEmpty ? sha256Hex(txt) : cHash
            let sender = (dict["senderName"] as? String ?? "연결된 내 기기").trimmingCharacters(in: .whitespacesAndNewlines)
            let createdIso = (dict["createdAt"] as? String ?? formatIsoUtcNow()).trimmingCharacters(in: .whitespacesAndNewlines)
            incoming.append(
                GhostKeyClipEntry(
                    clipHash: resolvedHash,
                    text: String(txt.prefix(4000)),
                    senderName: sender.isEmpty ? "연결된 내 기기" : sender,
                    createdAt: createdIso,
                    createdAtMs: parseIsoMs(createdIso)
                )
            )
        }
        let combined = (incoming + loadHistory()).sorted { $0.createdAtMs > $1.createdAtMs }
        var seen = Set<String>()
        var deduped: [GhostKeyClipEntry] = []
        let cutoff = Date().timeIntervalSince1970 * 1000.0 - retentionMs
        for it in combined {
            if it.createdAtMs > 0 && it.createdAtMs < cutoff { continue }
            if seen.insert(it.clipHash).inserted {
                deduped.append(it)
                if deduped.count >= maxKeychainItems { break }
            }
        }
        saveHistory(deduped)
        return deduped.count
    }

    @discardableResult
    static func pushLocalClip(_ rawText: String, senderName: String = "내 아이폰") -> GhostKeyClipEntry? {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let clipped = String(trimmed.prefix(4000))
        let nowMs = Date().timeIntervalSince1970 * 1000.0
        let iso = formatIsoUtcNow()
        let hash = sha256Hex(clipped)

        let existing = loadHistory()
        if let top = existing.first, top.clipHash == hash, (nowMs - top.createdAtMs) < 1500.0 {
            return top
        }

        let entry = GhostKeyClipEntry(
            clipHash: hash,
            text: clipped,
            senderName: senderName,
            createdAt: iso,
            createdAtMs: nowMs
        )

        var merged = [entry] + existing.filter { $0.clipHash != hash }
        if merged.count > maxKeychainItems { merged = Array(merged.prefix(maxKeychainItems)) }
        saveHistory(merged)
        saveSeqIndex(0)

        var pending = loadPendingOutbound().filter { $0.clipHash != hash }
        pending.insert(entry, at: 0)
        if pending.count > 40 { pending = Array(pending.prefix(40)) }
        if let pEnc = try? JSONEncoder().encode(pending) {
            writeSharedData(pEnc, forAccount: keyPendingOutbound)
        }

        pushEntryAsync(entry)
        return entry
    }

    static func loadPendingOutbound() -> [GhostKeyClipEntry] {
        guard let raw = readSharedData(forAccount: keyPendingOutbound),
              let decoded = try? JSONDecoder().decode([GhostKeyClipEntry].self, from: raw) else {
            return []
        }
        return decoded
    }

    static func consumePendingOutbound() -> [GhostKeyClipEntry] {
        let items = loadPendingOutbound()
        if !items.isEmpty {
            writeSharedData(nil, forAccount: keyPendingOutbound)
        }
        return items
    }

    static func removePendingOutbound(byHash clipHash: String) {
        let remaining = loadPendingOutbound().filter { $0.clipHash != clipHash }
        if remaining.isEmpty {
            writeSharedData(nil, forAccount: keyPendingOutbound)
        } else if let enc = try? JSONEncoder().encode(remaining) {
            writeSharedData(enc, forAccount: keyPendingOutbound)
        }
    }

    private static func loadSeqIndex() -> Int {
        guard let raw = readSharedData(forAccount: keySeqIndex),
              let str = String(data: raw, encoding: .utf8),
              let idx = Int(str) else {
            return 0
        }
        return idx
    }

    private static func saveSeqIndex(_ idx: Int) {
        writeSharedData(Data(String(idx).utf8), forAccount: keySeqIndex)
    }

    static func nextSequentialEntry() -> (Int, GhostKeyClipEntry)? {
        let items = loadHistory()
        guard !items.isEmpty else { return nil }
        let saved = loadSeqIndex()
        let idx = (saved >= 0 && saved < items.count) ? saved : 0
        saveSeqIndex((idx + 1) % items.count)
        return (idx, items[idx])
    }

    // MARK: - Direct AES-256-GCM + PBKDF2-HMAC-SHA256 (60,000 iter) Sync with PC
    private static func deriveSymmetricKey(email: String, uid: String) -> SymmetricKey? {
        let normEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normUid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normEmail.isEmpty, !normUid.isEmpty else { return nil }
        let tag = "\(normEmail)::\(normUid)"
        keyLock.lock()
        if let cached = keyCache[tag] {
            keyLock.unlock()
            return cached
        }
        keyLock.unlock()

        let passwordData = Data("ghosti-e2ee-clip-v1::\(normEmail)::\(normUid)".utf8)
        let saltData = Data("ghosti-salt-v1::\(normEmail)".utf8)
        var derivedBytes = [UInt8](repeating: 0, count: 32)
        let derivedCount = derivedBytes.count
        let status: Int32 = passwordData.withUnsafeBytes { pwRaw in
            saltData.withUnsafeBytes { saltRaw in
                guard let pwPtr = pwRaw.bindMemory(to: Int8.self).baseAddress,
                      let saltPtr = saltRaw.bindMemory(to: UInt8.self).baseAddress else {
                    return Int32(kCCParamError)
                }
                return CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    pwPtr,
                    passwordData.count,
                    saltPtr,
                    saltData.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    60000,
                    &derivedBytes,
                    derivedCount
                )
            }
        }
        guard status == kCCSuccess else { return nil }
        let symKey = SymmetricKey(data: Data(derivedBytes))
        keyLock.lock()
        if keyCache.count > 8 { keyCache.removeAll() }
        keyCache[tag] = symKey
        keyLock.unlock()
        return symKey
    }

    private static func encryptE2ee(plainText: String, key: SymmetricKey) -> (cipherB64: String, ivB64: String)? {
        var ivBytes = [UInt8](repeating: 0, count: 12)
        let ivLen = ivBytes.count
        guard SecRandomCopyBytes(kSecRandomDefault, ivLen, &ivBytes) == errSecSuccess else {
            return nil
        }
        let ivData = Data(ivBytes)
        guard let nonce = try? AES.GCM.Nonce(data: ivData),
              let sealed = try? AES.GCM.seal(Data(plainText.utf8), using: key, nonce: nonce) else {
            return nil
        }
        var combined = Data()
        combined.append(sealed.ciphertext)
        combined.append(sealed.tag)
        return (combined.base64EncodedString(), ivData.base64EncodedString())
    }

    private static func decryptE2ee(cipherB64: String, ivB64: String, key: SymmetricKey) -> String? {
        guard let ivData = Data(base64Encoded: ivB64),
              let rawCipher = Data(base64Encoded: cipherB64),
              rawCipher.count >= 16,
              let nonce = try? AES.GCM.Nonce(data: ivData) else {
            return nil
        }
        let ct = rawCipher.prefix(rawCipher.count - 16)
        let tag = rawCipher.suffix(16)
        guard let box = try? AES.GCM.SealedBox(nonce: nonce, ciphertext: ct, tag: tag),
              let opened = try? AES.GCM.open(box, using: key) else {
            return nil
        }
        return String(data: opened, encoding: .utf8)
    }

    private static func postBridgeJson(endpoint: String, hubToken: String, body: [String: Any], completion: @escaping ([String: Any]?) -> Void) {
        guard let url = URL(string: endpoint),
              let payload = try? JSONSerialization.data(withJSONObject: body, options: []) else {
            completion(nil)
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 6.5
        req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(hubToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = payload

        URLSession.shared.dataTask(with: req) { data, resp, err in
            guard err == nil,
                  let http = resp as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  let validData = data,
                  let json = (try? JSONSerialization.jsonObject(with: validData, options: [])) as? [String: Any] else {
                completion(nil)
                return
            }
            completion(json)
        }.resume()
    }

    static func pushEntryAsync(_ entry: GhostKeyClipEntry) {
        ioQueue.async {
            guard var ctx = loadAuthContext(),
                  !ctx.email.isEmpty,
                  !ctx.canonicalUserId.isEmpty,
                  !ctx.hubToken.isEmpty,
                  let symKey = deriveSymmetricKey(email: ctx.email, uid: ctx.canonicalUserId),
                  let enc = encryptE2ee(plainText: entry.text, key: symKey) else {
                return
            }
            let body: [String: Any] = [
                "action": "device_push_e2ee_clip",
                "clipHash": entry.clipHash,
                "cipherB64": enc.cipherB64,
                "ivB64": enc.ivB64,
                "senderDeviceId": ctx.deviceId.isEmpty ? "ios-keyboard-direct" : ctx.deviceId,
                "senderName": ctx.deviceName.isEmpty ? "내 아이폰" : ctx.deviceName,
                "createdAt": entry.createdAt
            ]
            postBridgeJson(endpoint: ctx.bridgeUrl, hubToken: ctx.hubToken, body: body) { resp in
                guard let resp = resp, (resp["ok"] as? Bool) == true else { return }
                if let srvUid = (resp["canonicalUserId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !srvUid.isEmpty, srvUid != ctx.canonicalUserId {
                    ctx.canonicalUserId = srvUid
                    if let encCtx = try? JSONEncoder().encode(ctx) {
                        writeSharedData(encCtx, forAccount: keyAuthContext)
                    }
                }
                removePendingOutbound(byHash: entry.clipHash)
            }
        }
    }

    static func pullRemoteAsync(force: Bool = false, onUpdated: (() -> Void)? = nil) {
        let nowMs = Date().timeIntervalSince1970 * 1000.0
        if !force && (nowMs - lastPullAtMs) < 1000.0 {
            return
        }
        lastPullAtMs = nowMs

        ioQueue.async {
            guard var ctx = loadAuthContext(),
                  !ctx.email.isEmpty,
                  !ctx.hubToken.isEmpty else {
                return
            }
            postBridgeJson(endpoint: ctx.bridgeUrl, hubToken: ctx.hubToken, body: ["action": "device_pull_e2ee_clips"]) { resp in
                guard let resp = resp, (resp["ok"] as? Bool) == true else { return }
                let srvUid = (resp["canonicalUserId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !srvUid.isEmpty && srvUid != ctx.canonicalUserId {
                    ctx.canonicalUserId = srvUid
                    if let encCtx = try? JSONEncoder().encode(ctx) {
                        writeSharedData(encCtx, forAccount: keyAuthContext)
                    }
                }
                let effectiveUid = !srvUid.isEmpty ? srvUid : ctx.canonicalUserId
                guard !effectiveUid.isEmpty,
                      let rawItems = resp["items"] as? [[String: Any]],
                      !rawItems.isEmpty else {
                    return
                }
                ioQueue.async {
                    guard let primaryKey = deriveSymmetricKey(email: ctx.email, uid: effectiveUid) else { return }
                    let fallbackKey = (!ctx.canonicalUserId.isEmpty && ctx.canonicalUserId != effectiveUid)
                        ? deriveSymmetricKey(email: ctx.email, uid: ctx.canonicalUserId)
                        : nil

                    var decryptedRows: [[String: Any]] = []
                    for env in rawItems.prefix(80) {
                        let cipherB64 = (env["cipherB64"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        let ivB64 = (env["ivB64"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !cipherB64.isEmpty, !ivB64.isEmpty else { continue }

                        var plain = decryptE2ee(cipherB64: cipherB64, ivB64: ivB64, key: primaryKey)
                        if plain == nil, let fb = fallbackKey {
                            plain = decryptE2ee(cipherB64: cipherB64, ivB64: ivB64, key: fb)
                        }
                        guard let validPlain = plain?.trimmingCharacters(in: .whitespacesAndNewlines),
                              !validPlain.isEmpty else { continue }

                        let cHash = (env["clipHash"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        decryptedRows.append([
                            "clipHash": cHash.isEmpty ? sha256Hex(validPlain) : cHash,
                            "text": validPlain,
                            "senderName": (env["senderName"] as? String) ?? "연결된 내 기기",
                            "createdAt": (env["createdAt"] as? String) ?? formatIsoUtcNow()
                        ])
                    }
                    if !decryptedRows.isEmpty {
                        _ = mergeFromWebHistory(decryptedRows)
                        if let cb = onUpdated {
                            DispatchQueue.main.async { cb() }
                        }
                    }
                }
            }
        }
    }
}
