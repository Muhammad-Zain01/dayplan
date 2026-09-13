import Foundation
import Security

actor KeychainCredentialStore: CredentialStore {
    private let service: String

    init(service: String) {
        self.service = service
    }

    func containsCredential(for kind: CredentialKind) async throws -> Bool {
        try await readCredential(for: kind) != nil
    }

    func saveCredential(_ value: String, for kind: CredentialKind) async throws {
        guard let data = value.data(using: .utf8) else {
            throw CredentialStoreError.invalidEncoding
        }

        let query = baseQuery(for: kind)
        let attributes: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw CredentialStoreError.operationFailed(addStatus)
            }
        } else if updateStatus != errSecSuccess {
            throw CredentialStoreError.operationFailed(updateStatus)
        }
    }

    func readCredential(for kind: CredentialKind) async throws -> String? {
        var query = baseQuery(for: kind)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw CredentialStoreError.operationFailed(status)
        }
        guard let data = result as? Data,
            let value = String(data: data, encoding: .utf8)
        else {
            throw CredentialStoreError.invalidEncoding
        }
        return value
    }

    func removeCredential(for kind: CredentialKind) async throws {
        let status = SecItemDelete(baseQuery(for: kind) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CredentialStoreError.operationFailed(status)
        }
    }

    private func baseQuery(for kind: CredentialKind) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: kind.account,
        ]
    }
}

enum CredentialStoreError: Error {
    case invalidEncoding
    case operationFailed(OSStatus)
}
