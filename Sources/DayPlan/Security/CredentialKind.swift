import Foundation

enum CredentialKind: String, CaseIterable, Hashable, Sendable {
    case todoist
    case openAI
    case anthropic

    var title: String {
        switch self {
        case .todoist: "Todoist API token"
        case .openAI: "OpenAI API key"
        case .anthropic: "Anthropic API key"
        }
    }

    var account: String {
        switch self {
        case .todoist: "todoist.access-token"
        case .openAI: "openai.api-key"
        case .anthropic: "anthropic.api-key"
        }
    }
}
