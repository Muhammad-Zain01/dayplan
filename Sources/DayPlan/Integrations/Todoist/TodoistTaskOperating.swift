import Foundation

protocol TodoistTaskOperating: Sendable {
    func listTasks(limit: Int = 100, projectID: String? = nil) async throws -> [TodoistTask]
    func getTask(id: String) async throws -> TodoistTask
    func listProjects() async throws -> [TodoistProject]
    func listLabels() async throws -> [TodoistLabel]
    func createTask(draft: TodoistTaskDraft) async throws -> TodoistTask
    func updateTask(id: String, patch: TodoistTaskPatch) async throws -> TodoistTask
    func completeTask(id: String) async throws
    func reopenTask(id: String) async throws
    func deleteTask(id: String) async throws
}

typealias TodoistTaskProviding = TodoistTaskOperating

enum TaskField<Value: Sendable>: Sendable {
    case unchanged
    case clear
    case set(Value)
}

struct TodoistTaskPatch: Sendable {
    var content: TaskField<String> = .unchanged
    var description: TaskField<String> = .unchanged
    var dueDate: TaskField<String> = .unchanged
    var priority: TaskField<Int> = .unchanged
    var labels: TaskField<[String]> = .unchanged

    var normalized: TodoistTaskPatch {
        var result = self
        if case .set(let value) = content {
            result.content = .set(value.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        if case .set(let value) = description {
            result.description = .set(value.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        if case .set(let value) = labels {
            result.labels = .set(Array(Set(value.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })).sorted())
        }
        return result
    }
}
