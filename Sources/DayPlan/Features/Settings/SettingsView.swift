import SwiftUI
import AppKit

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

            Section("MCP server") {
                LabeledContent("Local stdio server", value: "Available on launch")
                Text(
                    "Connect a local MCP client to DayPlan. Reads run immediately; every task change asks for confirmation in a DayPlan dialog."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                Text(
                    "Tools: list/get projects, labels and tasks; create, update, complete, reopen and delete tasks."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                Button("Copy Claude Desktop configuration") {
                    copyMCPConfiguration()
                }
                .help(
                    "Copies a configuration fragment. Paste it into your MCP client's configuration file."
                )
                Text(
                    "The MCP process reads the Todoist token from this app's Keychain service. DayPlan does not edit client configuration files."
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

    private func copyMCPConfiguration() {
        let executablePath = Bundle.main.bundleURL
            .appendingPathComponent("Contents/Helpers/dayplan-mcp")
            .path
        let configuration: [String: Any] = [
            "mcpServers": [
                "dayplan": [
                    "command": executablePath,
                    "args": [],
                ]
            ]
        ]
        guard
            let data = try? JSONSerialization.data(
                withJSONObject: configuration, options: [.prettyPrinted, .sortedKeys]),
            let text = String(data: data, encoding: .utf8)
        else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}
