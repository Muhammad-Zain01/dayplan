import Foundation

final class TodoistAPIClient: TodoistTaskProviding, @unchecked Sendable {
    private let credentialStore: any CredentialStore
    private let session: URLSession
    private let baseURL = URL(string: "https://api.todoist.com/api/v1")

    init(credentialStore: any CredentialStore, session: URLSession = .shared) {
        self.credentialStore = credentialStore
        self.session = session
    }

    func listTasks(limit: Int = 100, projectID: String? = nil) async throws -> [TodoistTask] {
        let token = try await accessToken()
        var tasks: [TodoistTask] = []
        var cursor: String?
        let boundedLimit = min(max(limit, 1), 100)

        repeat {
            var components = URLComponents(
                url: try endpoint("tasks"), resolvingAgainstBaseURL: false)
            var queryItems = [
                URLQueryItem(name: "limit", value: String(min(100, boundedLimit - tasks.count)))
            ]
            if let projectID, !projectID.isEmpty {
                queryItems.append(URLQueryItem(name: "project_id", value: projectID))
            }
            if let cursor {
                queryItems.append(URLQueryItem(name: "cursor", value: cursor))
            }
            components?.queryItems = queryItems
            guard let url = components?.url else { throw TodoistAPIError.invalidResponse }

            let data = try await sendRequest(url: url, method: "GET", token: token)
            let page = try JSONDecoder().decode(TodoistTaskPage.self, from: data)
            tasks.append(contentsOf: page.results)
            cursor = page.nextCursor
        } while cursor != nil && tasks.count < boundedLimit

        return tasks
    }

    func getTask(id: String) async throws -> TodoistTask {
        let token = try await accessToken()
        let data = try await sendRequest(url: endpoint("tasks/\(id)"), method: "GET", token: token)
        do { return try JSONDecoder().decode(TodoistTask.self, from: data) } catch {
            throw TodoistAPIError.invalidResponse
        }
    }

    func listProjects() async throws -> [TodoistProject] {
        let token = try await accessToken()
        var projects: [TodoistProject] = []
        var cursor: String?

        repeat {
            var components = URLComponents(
                url: try endpoint("projects"), resolvingAgainstBaseURL: false)
            var queryItems = [URLQueryItem(name: "limit", value: "100")]
            if let cursor {
                queryItems.append(URLQueryItem(name: "cursor", value: cursor))
            }
            components?.queryItems = queryItems
            guard let url = components?.url else { throw TodoistAPIError.invalidResponse }

            let data = try await sendRequest(url: url, method: "GET", token: token)
            let page = try JSONDecoder().decode(TodoistProjectPage.self, from: data)
            projects.append(contentsOf: page.results)
            cursor = page.nextCursor
        } while cursor != nil

        return projects.sorted {
            if $0.isInbox != $1.isInbox { return $0.isInbox }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    func listLabels() async throws -> [TodoistLabel] {
        let token = try await accessToken()
        var labels: [TodoistLabel] = []
        var cursor: String?

        repeat {
            var components = URLComponents(
                url: try endpoint("labels"), resolvingAgainstBaseURL: false)
            var queryItems = [URLQueryItem(name: "limit", value: "100")]
            if let cursor {
                queryItems.append(URLQueryItem(name: "cursor", value: cursor))
            }
            components?.queryItems = queryItems
            guard let url = components?.url else { throw TodoistAPIError.invalidResponse }

            let data = try await sendRequest(url: url, method: "GET", token: token)
            let page = try JSONDecoder().decode(TodoistLabelPage.self, from: data)
            labels.append(contentsOf: page.results)
            cursor = page.nextCursor
        } while cursor != nil

        return labels.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    func createTask(draft: TodoistTaskDraft) async throws -> TodoistTask {
        let token = try await accessToken()
        let url = try endpoint("tasks")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 20
        request.httpBody = try JSONEncoder().encode(
            TodoistCreateTaskRequest(
                content: draft.content,
                description: draft.description.isEmpty ? nil : draft.description,
                projectID: draft.projectID,
                dueDate: draft.dueDate,
                priority: draft.priority,
                labels: draft.labels
            )
        )

        let data = try await send(request)
        do {
            return try JSONDecoder().decode(TodoistTask.self, from: data)
        } catch {
            throw TodoistAPIError.invalidResponse
        }
    }

    func completeTask(id: String) async throws {
        let token = try await accessToken()
        let url = try endpoint("tasks/\(id)/close")
        _ = try await sendRequest(url: url, method: "POST", token: token)
    }

    func reopenTask(id: String) async throws {
        let token = try await accessToken()
        let url = try endpoint("tasks/\(id)/reopen")
        _ = try await sendRequest(url: url, method: "POST", token: token)
    }

    func deleteTask(id: String) async throws {
        let token = try await accessToken()
        let url = try endpoint("tasks/\(id)")
        _ = try await sendRequest(url: url, method: "DELETE", token: token)
    }

    func updateTask(id: String, patch: TodoistTaskPatch) async throws -> TodoistTask {
        let token = try await accessToken()
        let url = try endpoint("tasks/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 20
        request.httpBody = try JSONEncoder().encode(TodoistUpdateTaskRequest(patch: patch))
        let data = try await send(request)
        do { return try JSONDecoder().decode(TodoistTask.self, from: data) } catch {
            throw TodoistAPIError.invalidResponse
        }
    }

    private func accessToken() async throws -> String {
        guard let token = try await credentialStore.readCredential(for: .todoist), !token.isEmpty
        else {
            throw TodoistAPIError.credentialMissing
        }
        return token
    }

    private func endpoint(_ path: String) throws -> URL {
        guard let baseURL else { throw TodoistAPIError.invalidResponse }
        return baseURL.appending(path: path)
    }

    private func sendRequest(url: URL, method: String, token: String) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20
        return try await send(request)
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw TodoistAPIError.networkUnavailable
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TodoistAPIError.invalidResponse
        }
        switch httpResponse.statusCode {
        case 200..<300:
            return data
        case 401:
            throw TodoistAPIError.unauthorized
        default:
            throw TodoistAPIError.serverResponse(httpResponse.statusCode)
        }
    }
}

struct TodoistUpdateTaskRequest: Encodable {
    let patch: TodoistTaskPatch

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try encode(patch.content, key: .content, in: &container)
        try encode(patch.description, key: .description, in: &container)
        try encode(patch.dueDate, key: .dueDate, in: &container)
        try encode(patch.priority, key: .priority, in: &container)
        try encode(patch.labels, key: .labels, in: &container)
    }

    private func encode<Value: Encodable>(
        _ field: TaskField<Value>, key: CodingKeys,
        in container: inout KeyedEncodingContainer<CodingKeys>
    ) throws {
        switch field {
        case .unchanged: break
        case .clear: try container.encodeNil(forKey: key)
        case .set(let value): try container.encode(value, forKey: key)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case content
        case description
        case dueDate = "due_date"
        case priority
        case labels
    }
}

private struct TodoistTaskPage: Decodable {
    let results: [TodoistTask]
    let nextCursor: String?

    private enum CodingKeys: String, CodingKey {
        case results
        case nextCursor = "next_cursor"
    }
}

private struct TodoistProjectPage: Decodable {
    let results: [TodoistProject]
    let nextCursor: String?

    private enum CodingKeys: String, CodingKey {
        case results
        case nextCursor = "next_cursor"
    }
}

private struct TodoistLabelPage: Decodable {
    let results: [TodoistLabel]
    let nextCursor: String?

    private enum CodingKeys: String, CodingKey {
        case results
        case nextCursor = "next_cursor"
    }
}

struct TodoistCreateTaskRequest: Encodable {
    let content: String
    let description: String?
    let projectID: String?
    let dueDate: String?
    let priority: Int
    let labels: [String]

    private enum CodingKeys: String, CodingKey {
        case content
        case description
        case projectID = "project_id"
        case dueDate = "due_date"
        case priority
        case labels
    }
}
