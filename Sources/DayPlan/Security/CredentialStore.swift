import Foundation

protocol CredentialStore: Sendable {
    func containsCredential(for kind: CredentialKind) async throws -> Bool
    func saveCredential(_ value: String, for kind: CredentialKind) async throws
    func readCredential(for kind: CredentialKind) async throws -> String?
    func removeCredential(for kind: CredentialKind) async throws
}
