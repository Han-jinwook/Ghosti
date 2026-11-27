import Foundation
import Security
import CryptoKit
import CommonCrypto

/// [Ghosti 3귀신] iOS Shared Keychain 공용 7일(168시간) 클립보드 & 무화면 공유 익스텐션(GhostKeyShareExtension) 직결 엔진
/// - Keychain Access Group: 7K5PPQDZ5L.app.sundreamer.ghosti (본체 App 및 GhostKeyShareExtension 무결성 공유)
/// - 1) 아이폰 [공유...] ➔ [귀신같이] 선택 시 본체 앱을 열지 않고([붙여넣기 허용] 팝업 0회) 텍스트·링크·사진을 PC Ctrl+V로 직송
/// - 2) PC [📱 폰으로 보내기] 클릭 시 도착한 선택 전송 패킷을 복호화해 [📋 복사] 1탭 알림 배너로 즉시 전달
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
    private static let keyCachedRawKey = "ghosti_shared_clipboard_rawkey_v1"
    private static let keySeenPushIds = "ghosti_seen_phone_push_ids_v1"

    private static let ioQueue = DispatchQueue(label: "app.sundreamer.ghosti.sharedclip.io", qos: .userInitiated)
    private static let keyLock = NSLock()
    private static let pushSeenLock = NSLock()
    private static var keyCache: [String: SymmetricKey] = [:]
    private static var memorySeenPushIds: Set<String> = []
    private static var lastPullAtMs: Double = 0
    private static var lastPushSinceMs: Double = Date().timeIntervalSince1970 * 1000.0 - 10.0 * 60.0 * 1000.0

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
            deviceId: normDevId.isEmpty ? "ios-share-direct" : normDevId,
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
            writeSharedData(encoded, forAccount: keyHistory)
        }
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
        var resultEntry: GhostKeyClipEntry?
        let sem = DispatchSemaphore(value: 0)
        pushClipDirect(rawText, senderName: senderName) { _ in
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 0.05)
        resultEntry = loadHistory().first
        return resultEntry
    }

    /// Share Extension 진입 0ms에 TLS 연결 및 암호화 키를 선행 예열해 전송 체감 지연을 최소화합니다.
    static func prewarmBridgeConnection() {
        ioQueue.async {
            guard let ctx = loadAuthContext(),
                  !ctx.email.isEmpty else { return }
            if !ctx.canonicalUserId.isEmpty {
                _ = deriveSymmetricKey(email: ctx.email, uid: ctx.canonicalUserId)
            }
            if let url = URL(string: ctx.bridgeUrl) {
                var headReq = URLRequest(url: url)
                headReq.httpMethod = "OPTIONS"
                headReq.timeoutInterval = 3.0
                URLSession.shared.dataTask(with: headReq) { _, _, _ in }.resume()
            }
        }
    }

    /// Share Extension 전용: 메인 스레드 Keychain I/O 차단을 0%로 제거하고 HTTPS 직송을 최우선 발사합니다.
    static func pushClipDirect(_ rawText: String, senderName: String = "내 아이폰", completion: @escaping (Bool) -> Void) {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            completion(false)
            return
        }
        let clipped = String(trimmed.prefix(8000))
        let nowMs = Date().timeIntervalSince1970 * 1000.0
        let iso = formatIsoUtcNow()
        let hash = sha256Hex(clipped)

        let entry = GhostKeyClipEntry(
            clipHash: hash,
            text: clipped,
            senderName: senderName,
            createdAt: iso,
            createdAtMs: nowMs
        )

        let lock = NSLock()
        var finished = false
        let completeOnce: (Bool) -> Void = { ok in
            lock.lock()
            defer { lock.unlock() }
            if finished { return }
            finished = true
            completion(ok)
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 2.8) {
            completeOnce(false)
        }

        // 1순위(0ms): 네트워크 전송부터 최우선 비동기 발사!
        pushEntryAsync(entry) { ok in
            completeOnce(ok)
        }

        // 2순위(병렬 백그라운드): 로컬 Keychain 7일 보관함 기록은 네트워크 대기와 겹쳐서 비차단 처리
        DispatchQueue.global(qos: .utility).async {
            let existing = loadHistory()
            var merged = [entry] + existing.filter { $0.clipHash != hash }
            if merged.count > maxKeychainItems { merged = Array(merged.prefix(maxKeychainItems)) }
            saveHistory(merged)
            var pending = loadPendingOutbound().filter { $0.clipHash != hash }
            pending.insert(entry, at: 0)
            if pending.count > 40 { pending = Array(pending.prefix(40)) }
            if let pEnc = try? JSONEncoder().encode(pending) {
                writeSharedData(pEnc, forAccount: keyPendingOutbound)
            }
        }
    }

    /// Share Extension 사진·스크린샷 [공유 ➔ 귀신같이] 2탭 무화면 직송
    static func pushPhotoDirectToPc(
        imageData: Data,
        fileName: String,
        mimeType: String,
        width: Int,
        height: Int,
        completion: @escaping (Bool) -> Void
    ) {
        guard !imageData.isEmpty else {
            completion(false)
            return
        }
        let lock = NSLock()
        var finished = false
        let completeOnce: (Bool) -> Void = { ok in
            lock.lock()
            defer { lock.unlock() }
            if finished { return }
            finished = true
            completion(ok)
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 12.0) {
            completeOnce(false)
        }

        ioQueue.async {
            guard let ctx = loadAuthContext(),
                  !ctx.email.isEmpty,
                  !ctx.hubToken.isEmpty else {
                completeOnce(false)
                return
            }
            let body: [String: Any] = [
                "action": "device_push_photo_to_pc",
                "fileName": fileName,
                "mimeType": mimeType,
                "imageBase64": imageData.base64EncodedString(),
                "width": width,
                "height": height,
                "senderDeviceId": ctx.deviceId.isEmpty ? "ios-share-direct" : ctx.deviceId,
                "senderName": ctx.deviceName.isEmpty ? "내 아이폰" : ctx.deviceName
            ]
            postBridgeJson(endpoint: ctx.bridgeUrl, hubToken: ctx.hubToken, body: body, timeout: 11.0) { resp in
                let ok = (resp?["ok"] as? Bool) == true
                completeOnce(ok)
            }
        }
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

    // MARK: - Direct AES-256-GCM + Keychain Pre-Derived Key Cache (0.5ms Share Extension Cold Start)
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

        // Share Extension 새 프로세스 기동 시 60,000회 PBKDF2 재연산을 생략하도록 Keychain 캐시 우선 조회
        if let kcRaw = readSharedData(forAccount: keyCachedRawKey),
           let kcDict = (try? JSONSerialization.jsonObject(with: kcRaw, options: [])) as? [String: String],
           kcDict["tag"] == tag,
           let b64 = kcDict["keyB64"],
           let keyData = Data(base64Encoded: b64),
           keyData.count == 32 {
            let symKey = SymmetricKey(data: keyData)
            keyLock.lock()
            keyCache[tag] = symKey
            keyLock.unlock()
            return symKey
        }

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
        let derivedData = Data(derivedBytes)
        let symKey = SymmetricKey(data: derivedData)
        keyLock.lock()
        if keyCache.count > 8 { keyCache.removeAll() }
        keyCache[tag] = symKey
        keyLock.unlock()
        if let kcEnc = try? JSONSerialization.data(
            withJSONObject: ["tag": tag, "keyB64": derivedData.base64EncodedString()],
            options: []
        ) {
            writeSharedData(kcEnc, forAccount: keyCachedRawKey)
        }
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

    private static func postBridgeJson(
        endpoint: String,
        hubToken: String,
        body: [String: Any],
        timeout: TimeInterval = 6.5,
        completion: @escaping ([String: Any]?) -> Void
    ) {
        guard let url = URL(string: endpoint),
              let payload = try? JSONSerialization.data(withJSONObject: body, options: []) else {
            completion(nil)
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = timeout
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

    static func pushEntryAsync(_ entry: GhostKeyClipEntry, completion: ((Bool) -> Void)? = nil) {
        ioQueue.async {
            guard var ctx = loadAuthContext(),
                  !ctx.email.isEmpty,
                  !ctx.canonicalUserId.isEmpty,
                  !ctx.hubToken.isEmpty,
                  let symKey = deriveSymmetricKey(email: ctx.email, uid: ctx.canonicalUserId),
                  let enc = encryptE2ee(plainText: entry.text, key: symKey) else {
                completion?(false)
                return
            }
            let body: [String: Any] = [
                "action": "device_push_e2ee_clip",
                "clipHash": entry.clipHash,
                "cipherB64": enc.cipherB64,
                "ivB64": enc.ivB64,
                "senderDeviceId": ctx.deviceId.isEmpty ? "ios-share-direct" : ctx.deviceId,
                "senderName": entry.senderName.isEmpty ? ctx.deviceName : entry.senderName,
                "createdAt": entry.createdAt
            ]
            postBridgeJson(endpoint: ctx.bridgeUrl, hubToken: ctx.hubToken, body: body) { resp in
                guard let resp = resp, (resp["ok"] as? Bool) == true else {
                    completion?(false)
                    return
                }
                if let srvUid = (resp["canonicalUserId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !srvUid.isEmpty, srvUid != ctx.canonicalUserId {
                    ctx.canonicalUserId = srvUid
                    if let encCtx = try? JSONEncoder().encode(ctx) {
                        writeSharedData(encCtx, forAccount: keyAuthContext)
                    }
                }
                removePendingOutbound(byHash: entry.clipHash)
                completion?(true)
            }
        }
    }

    static func decryptClipText(cipherB64: String, ivB64: String) -> String? {
        let c = cipherB64.trimmingCharacters(in: .whitespacesAndNewlines)
        let iv = ivB64.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !c.isEmpty, !iv.isEmpty,
              let ctx = loadAuthContext(),
              !ctx.email.isEmpty,
              !ctx.canonicalUserId.isEmpty,
              let symKey = deriveSymmetricKey(email: ctx.email, uid: ctx.canonicalUserId) else {
            return nil
        }
        return decryptE2ee(cipherB64: c, ivB64: iv, key: symKey)
    }

    static func markPushIdSeen(_ pushId: String) -> Bool {
        let clean = pushId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return false }
        pushSeenLock.lock()
        defer { pushSeenLock.unlock() }
        if memorySeenPushIds.contains(clean) {
            return false
        }
        var seen: [String] = []
        if let raw = readSharedData(forAccount: keySeenPushIds),
           let arr = try? JSONDecoder().decode([String].self, from: raw) {
            seen = arr
        }
        if seen.contains(clean) {
            memorySeenPushIds.insert(clean)
            return false
        }
        memorySeenPushIds.insert(clean)
        seen.append(clean)
        if seen.count > 60 {
            seen = Array(seen.suffix(40))
        }
        if let enc = try? JSONEncoder().encode(seen) {
            writeSharedData(enc, forAccount: keySeenPushIds)
        }
        return true
    }

    private static func isPushIdSeen(_ pushId: String) -> Bool {
        let clean = pushId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return false }
        pushSeenLock.lock()
        defer { pushSeenLock.unlock() }
        if memorySeenPushIds.contains(clean) {
            return true
        }
        guard let raw = readSharedData(forAccount: keySeenPushIds),
              let arr = try? JSONDecoder().decode([String].self, from: raw) else {
            return false
        }
        if arr.contains(clean) {
            memorySeenPushIds.insert(clean)
            return true
        }
        return false
    }

    static func pullPhonePushInboxOnce(onPushArrived: @escaping (String, String, String) -> Void) {
        ioQueue.async {
            guard var ctx = loadAuthContext(),
                  !ctx.email.isEmpty,
                  !ctx.hubToken.isEmpty else {
                return
            }
            let floorMs = Date().timeIntervalSince1970 * 1000.0 - 10.0 * 60.0 * 1000.0
            let querySince = Int64(max(floorMs, lastPushSinceMs - 2000.0))
            let body: [String: Any] = [
                "action": "device_pull_phone_push_inbox",
                "sinceMs": querySince,
                "callerDeviceId": ctx.deviceId
            ]
            postBridgeJson(endpoint: ctx.bridgeUrl, hubToken: ctx.hubToken, body: body, timeout: 5.5) { resp in
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
                      let items = resp["items"] as? [[String: Any]],
                      !items.isEmpty,
                      let key = deriveSymmetricKey(email: ctx.email, uid: effectiveUid) else {
                    return
                }
                for item in items.reversed() {
                    let pushId = (item["pushId"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    let cMs = (item["createdAtMs"] as? NSNumber)?.doubleValue ?? (item["createdAtMs"] as? Double) ?? 0
                    if cMs > lastPushSinceMs {
                        lastPushSinceMs = cMs
                    }
                    guard !pushId.isEmpty, !isPushIdSeen(pushId) else { continue }
                    let cB64 = (item["cipherB64"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    let ivB64 = (item["ivB64"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !cB64.isEmpty, !ivB64.isEmpty,
                          let plain = decryptE2ee(cipherB64: cB64, ivB64: ivB64, key: key)?.trimmingCharacters(in: .whitespacesAndNewlines),
                          !plain.isEmpty else {
                        continue
                    }
                    let sender = (item["senderName"] as? String) ?? "내 PC"
                    onPushArrived(pushId, plain, sender)
                }
            }
        }
    }
}
