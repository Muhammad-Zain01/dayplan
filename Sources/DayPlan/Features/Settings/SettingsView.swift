import SwiftUI

struct SettingsView: View {
    @ObservedObject var viewModel: CredentialSettingsViewModel

    var body: some View {
        Form {
            Section("Todoist") {
                credentialRow(for: .todoist)
                HStack {
                    Button("Test connection") {
                        Task { await viewModel.testTodoistConnection() }
                    }
                    .disabled(viewModel.isTestingTodoist || !viewModel.isConfigured(.todoist))

                    if viewModel.isTestingTodoist {
                        ProgressView()
                            .controlSize(.small)
                    }
                }
            }

            Section("AI providers") {
                credentialRow(for: .openAI)
                credentialRow(for: .anthropic)
                Text(
                    "AI provider keys are stored in Keychain. Provider connections will be added in a later module."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if let message = viewModel.statusMessage {
                Section {
                    Label(message, systemImage: "checkmark.circle")
                        .foregroundStyle(.green)
                }
            }

            if let error = viewModel.errorMessage {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                }
            }

            Section("Privacy") {
                LabeledContent("Local database", value: "Application Support / DayPlan")
                LabeledContent("API keys", value: "macOS Keychain")
            }
        }
        .formStyle(.grouped)
        .padding(24)
        .frame(maxWidth: 760, maxHeight: .infinity, alignment: .topLeading)
        .navigationTitle("Settings")
        .task {
            await viewModel.refreshStatuses()
        }
    }

    @ViewBuilder
    private func credentialRow(for kind: CredentialKind) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(kind.title)
                    .font(.headline)
                Spacer()
                Label(
                    viewModel.isConfigured(kind) ? "Saved in Keychain" : "Not configured",
                    systemImage: viewModel.isConfigured(kind) ? "key.fill" : "key"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            HStack {
                SecureField("Paste API token", text: viewModel.binding(for: kind))
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.password)
                    .onSubmit { Task { await viewModel.saveCredential(for: kind) } }

                Button("Save") {
                    Task { await viewModel.saveCredential(for: kind) }
                }
                .disabled(viewModel.isSaving(kind))

                if viewModel.isConfigured(kind) {
                    Button("Remove", role: .destructive) {
                        Task { await viewModel.removeCredential(for: kind) }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}
