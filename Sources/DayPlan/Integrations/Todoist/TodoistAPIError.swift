import Foundation

enum TodoistAPIError: LocalizedError, Sendable {
    case credentialMissing
    case unauthorized
    case serverResponse(Int)
    case invalidResponse
    case networkUnavailable

    var errorDescription: String? {
        switch self {
        case .credentialMissing:
            "Add your Todoist API token in Settings to load tasks."
        case .unauthorized:
            "Todoist didn't accept this token. Check it in Settings and try again."
        case .serverResponse(let status):
            "Todoist returned an error (HTTP \(status)). Try again in a moment."
        case .invalidResponse:
            "Todoist returned an unexpected response."
        case .networkUnavailable:
            "Couldn't reach Todoist. Check your internet connection and try again."
        }
    }
}
