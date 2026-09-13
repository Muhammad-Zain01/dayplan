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

actor TodoistTaskService: TaskOperating {
    private let provider: any TodoistTaskProviding

    init(provider: any TodoistTaskProviding) {
        self.provider = provider
    }

    func listTasks(limit: Int = 100, projectID: String? = nil) async throws -> [TodoistTask] {
        let boundedLimit = min(max(limit, 1), 100)
        return try await provider.listTasks(limit: boundedLimit, projectID: projectID)
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
        if case .set(let content) = patch.content,
            content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        {
            throw TaskServiceError.emptyContent
        }
        if case .set(let priority) = patch.priority, !(1...4).contains(priority) {
            throw TaskServiceError.invalidPriority
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
}

enum TaskServiceError: Error, Sendable {
    case emptyContent
    case invalidTaskIdentifier
    case invalidPriority
}
