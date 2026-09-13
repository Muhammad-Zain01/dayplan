import Foundation

protocol TaskOperating: Sendable {
    func listTasks(limit: Int, projectID: String?) async throws -> [TodoistTask]
    func getTask(id: String) async throws -> TodoistTask
    func listProjects() async throws -> [TodoistProject]
    func listLabels() async throws -> [TodoistLabel]
    func createTask(draft: TodoistTaskDraft) async throws -> TodoistTask
    func updateTask(id: String, patch: TodoistTaskPatch) async throws -> TodoistTask
    func completeTask(id: String) async throws
    func reopenTask(id: String) async throws
    func deleteTask(id: String) async throws
}

extension TaskOperating {
    func listTasks() async throws -> [TodoistTask] {
        try await listTasks(limit: 100, projectID: nil)
    }
}

actor TodoistTaskService: TaskOperating {
    private let provider: any TodoistTaskProviding

    init(provider: any TodoistTaskProviding) {
        self.provider = provider
    }

    func listTasks(limit: Int = 100, projectID: String? = nil) async throws -> [TodoistTask] {
        let boundedLimit = min(max(limit, 1), 100)
        let boundedProjectID = try projectID.map(Self.validatedID)
        return try await provider.listTasks(limit: boundedLimit, projectID: boundedProjectID)
    }

    func getTask(id: String) async throws -> TodoistTask {
        try await provider.getTask(id: Self.validatedID(id))
    }

    func listProjects() async throws -> [TodoistProject] {
        try await provider.listProjects()
    }

    func listLabels() async throws -> [TodoistLabel] {
        try await provider.listLabels()
    }

    func createTask(draft: TodoistTaskDraft) async throws -> TodoistTask {
        let normalizedContent = draft.content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedContent.isEmpty else {
            throw TaskServiceError.emptyContent
        }
        guard normalizedContent.count <= 500,
            draft.description.count <= 5_000,
            draft.labels.count <= 50,
            draft.labels.allSatisfy({ $0.count <= 100 })
        else { throw TaskServiceError.invalidTaskField }
        if let dueDate = draft.dueDate, !Self.isValidDate(dueDate) {
            throw TaskServiceError.invalidTaskField
        }
        if let projectID = draft.projectID { _ = try Self.validatedID(projectID) }
        guard (1...4).contains(draft.priority) else {
            throw TaskServiceError.invalidPriority
        }

        let normalizedDraft = TodoistTaskDraft(
            content: normalizedContent,
            description: draft.description.trimmingCharacters(in: .whitespacesAndNewlines),
            projectID: draft.projectID,
            dueDate: draft.dueDate,
            priority: draft.priority,
            labels: Array(
                Set(draft.labels.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })
            )
            .filter { !$0.isEmpty }
            .sorted()
        )
        return try await provider.createTask(draft: normalizedDraft)
    }

    func updateTask(id: String, patch: TodoistTaskPatch) async throws -> TodoistTask {
        let taskID = try Self.validatedID(id)
        if case .set(let content) = patch.content {
            let value = content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { throw TaskServiceError.emptyContent }
            guard value.count <= 500 else { throw TaskServiceError.invalidTaskField }
        }
        if case .set(let priority) = patch.priority, !(1...4).contains(priority) {
            throw TaskServiceError.invalidPriority
        }
        if case .set(let dueDate) = patch.dueDate, !Self.isValidDate(dueDate) {
            throw TaskServiceError.invalidTaskField
        }
        if case .set(let description) = patch.description, description.count > 5_000 {
            throw TaskServiceError.invalidTaskField
        }
        if case .set(let labels) = patch.labels,
            labels.count > 50 || labels.contains(where: { $0.count > 100 })
        {
            throw TaskServiceError.invalidTaskField
        }
        return try await provider.updateTask(id: taskID, patch: patch.normalized)
    }

    func completeTask(id: String) async throws {
        try await provider.completeTask(id: Self.validatedID(id))
    }

    func reopenTask(id: String) async throws {
        try await provider.reopenTask(id: Self.validatedID(id))
    }

    func deleteTask(id: String) async throws {
        try await provider.deleteTask(id: Self.validatedID(id))
    }

    private static func validatedID(_ id: String) throws -> String {
        let normalized = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, normalized.count <= 128 else {
            throw TaskServiceError.invalidTaskIdentifier
        }
        return normalized
    }

    private static func isValidDate(_ value: String) -> Bool {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        return formatter.date(from: value) != nil
    }
}

enum TaskServiceError: Error, Sendable {
    case emptyContent
    case invalidTaskIdentifier
    case invalidPriority
    case invalidTaskField
}
