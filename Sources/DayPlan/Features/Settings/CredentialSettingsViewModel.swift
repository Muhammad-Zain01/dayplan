import Foundation
import SwiftUI

@MainActor
final class CredentialSettingsViewModel: ObservableObject {
    @Published private(set) var configuredCredentials: Set<CredentialKind> = []
    @Published private(set) var savingCredentials: Set<CredentialKind> = []
    @Published private(set) var isTestingTodoist = false
    @Published private(set) var statusMessage: String?
    @Published private(set) var errorMessage: String?
    @Published private var drafts: [CredentialKind: String] = [:]

    private let credentialStore: CredentialStore
    private let todoistService: TaskOperating

    init(credentialStore: CredentialStore, todoistService: TaskOperating) {
        self.credentialStore = credentialStore
        self.todoistService = todoistService
    }

    func binding(for kind: CredentialKind) -> Binding<String> {
        Binding(
            get: { self.drafts[kind, default: ""] },
            set: { self.drafts[kind] = $0 }
        )
    }

    func isConfigured(_ kind: CredentialKind) -> Bool {
        configuredCredentials.contains(kind)
    }

    func isSaving(_ kind: CredentialKind) -> Bool {
        savingCredentials.contains(kind)
    }

    func refreshStatuses() async {
        var configured = Set<CredentialKind>()
        for kind in CredentialKind.allCases {
            do {
                if try await credentialStore.containsCredential(for: kind) {
                    configured.insert(kind)
                }
            } catch {
                errorMessage = "Couldn't read credential status from macOS Keychain."
                return
            }
        }
        configuredCredentials = configured
    }

    func saveCredential(for kind: CredentialKind) async {
        let value = drafts[kind, default: ""].trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !isSaving(kind) else {
            errorMessage = "Paste a value before saving the credential."
            return
        }

        savingCredentials.insert(kind)
        clearFeedback()
        defer { savingCredentials.remove(kind) }

        do {
            try await credentialStore.saveCredential(value, for: kind)
            configuredCredentials.insert(kind)
            drafts[kind] = ""
            statusMessage = "\(kind.title) credential saved securely in macOS Keychain."
        } catch {
            errorMessage = "Couldn't save that credential to macOS Keychain."
        }
    }

    func removeCredential(for kind: CredentialKind) async {
        clearFeedback()
        do {
            try await credentialStore.removeCredential(for: kind)
            configuredCredentials.remove(kind)
            statusMessage = "\(kind.title) credential removed from Keychain."
        } catch {
            errorMessage = "Couldn't remove that credential from macOS Keychain."
        }
    }

    func testTodoistConnection() async {
        guard !isTestingTodoist else { return }
        isTestingTodoist = true
        clearFeedback()
        defer { isTestingTodoist = false }

        do {
            let tasks = try await todoistService.listTasks()
            statusMessage = "Connected to Todoist. Found \(tasks.count) active task(s)."
        } catch let error as TodoistAPIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Couldn't connect to Todoist. Check your token and internet connection."
        }
    }

    private func clearFeedback() {
        statusMessage = nil
        errorMessage = nil
    }
}
