import Foundation

final class ListTodoistTasksTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_list_tasks",
        description:
            "List up to 100 active tasks from the connected Todoist account. Use project_id to filter to one project. The default limit is 100.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":100},"project_id":{"type":"string","minLength":1}},"additionalProperties":false}"#,
        requiresUserConfirmation: false
    )

    private let taskService: any TaskOperating

    init(taskService: any TaskOperating) {
        self.taskService = taskService
    }

    func execute(input: Data) async throws -> Data {
        do {
            let request = try JSONDecoder().decode(ListTasksToolInput.self, from: input)
            return try JSONEncoder().encode(
                await taskService.listTasks(
                    limit: request.limit ?? 100, projectID: request.projectID))
        } catch is DecodingError {
            throw ApplicationToolError.invalidInput
        }
    }
}

final class GetTodoistTaskTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_get_task",
        description:
            "Get one active Todoist task by its exact task_id. Discover opaque IDs with todoist_list_tasks; do not guess them.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"task_id":{"type":"string","minLength":1}},"required":["task_id"],"additionalProperties":false}"#,
        requiresUserConfirmation: false
    )
    private let taskService: any TaskOperating
    init(taskService: any TaskOperating) { self.taskService = taskService }
    func execute(input: Data) async throws -> Data {
        do {
            let request = try JSONDecoder().decode(TaskIDToolInput.self, from: input)
            return try JSONEncoder().encode(await taskService.getTask(id: request.taskID))
        } catch is DecodingError { throw ApplicationToolError.invalidInput }
    }
}

final class ListTodoistProjectsTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_list_projects",
        description: "List active Todoist projects, including the Inbox, for project selection.",
        inputSchemaJSON: #"{"type":"object","properties":{},"additionalProperties":false}"#,
        requiresUserConfirmation: false
    )

    private let taskService: any TaskOperating

    init(taskService: any TaskOperating) {
        self.taskService = taskService
    }

    func execute(input: Data) async throws -> Data {
        do {
            _ = try JSONDecoder().decode(EmptyToolInput.self, from: input)
            return try JSONEncoder().encode(await taskService.listProjects())
        } catch is DecodingError {
            throw ApplicationToolError.invalidInput
        }
    }
}

final class ListTodoistLabelsTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_list_labels",
        description: "List existing Todoist labels so a task can be assigned valid labels by name.",
        inputSchemaJSON: #"{"type":"object","properties":{},"additionalProperties":false}"#,
        requiresUserConfirmation: false
    )

    private let taskService: any TaskOperating

    init(taskService: any TaskOperating) {
        self.taskService = taskService
    }

    func execute(input: Data) async throws -> Data {
        do {
            _ = try JSONDecoder().decode(EmptyToolInput.self, from: input)
            return try JSONEncoder().encode(await taskService.listLabels())
        } catch is DecodingError {
            throw ApplicationToolError.invalidInput
        }
    }
}

final class CreateTodoistTaskTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_create_task",
        description:
            "Create one Todoist task. Use a project ID from todoist_list_projects when the user names a project and label names from todoist_list_labels when labels are requested. Without project_id the task goes to Inbox. due_date is YYYY-MM-DD. Todoist API priority is 1 for P4/normal through 4 for P1/urgent.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"content":{"type":"string","minLength":1,"maxLength":500},"description":{"type":"string","maxLength":5000},"project_id":{"type":"string","minLength":1,"maxLength":128},"due_date":{"type":"string","format":"date"},"priority":{"type":"integer","minimum":1,"maximum":4},"labels":{"type":"array","maxItems":50,"items":{"type":"string","minLength":1,"maxLength":100},"uniqueItems":true}},"required":["content"],"additionalProperties":false}"#,
        requiresUserConfirmation: true
    )

    private let taskService: any TaskOperating

    init(taskService: any TaskOperating) {
        self.taskService = taskService
    }

    func execute(input: Data) async throws -> Data {
        let request: CreateTaskToolInput
        do {
            request = try JSONDecoder().decode(CreateTaskToolInput.self, from: input)
        } catch {
            throw ApplicationToolError.invalidInput
        }
        let draft = TodoistTaskDraft(
            content: request.content,
            description: request.description ?? "",
            projectID: request.projectID,
            dueDate: request.dueDate,
            priority: request.priority ?? 1,
            labels: request.labels ?? []
        )
        return try JSONEncoder().encode(await taskService.createTask(draft: draft))
    }
}

final class CompleteTodoistTaskTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_complete_task",
        description:
            "Mark one active Todoist task as complete. Confirm with the user before changing task state.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"task_id":{"type":"string","minLength":1}},"required":["task_id"],"additionalProperties":false}"#,
        requiresUserConfirmation: true
    )

    private let taskService: any TaskOperating

    init(taskService: any TaskOperating) {
        self.taskService = taskService
    }

    func execute(input: Data) async throws -> Data {
        let request: CompleteTaskToolInput
        do {
            request = try JSONDecoder().decode(CompleteTaskToolInput.self, from: input)
        } catch {
            throw ApplicationToolError.invalidInput
        }
        try await taskService.completeTask(id: request.taskID)
        return Data("{\"completed\":true}".utf8)
    }
}

final class UpdateTodoistTaskTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_update_task",
        description:
            "Update supplied fields on one Todoist task. Omitted fields stay unchanged; pass due_date as null to clear its date. Todoist priority is 1 (P4/normal) through 4 (P1/urgent). Requires DayPlan confirmation.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"task_id":{"type":"string","minLength":1,"maxLength":128},"content":{"type":"string","minLength":1,"maxLength":500},"description":{"type":"string","maxLength":5000},"due_date":{"type":["string","null"],"format":"date"},"priority":{"type":"integer","minimum":1,"maximum":4},"labels":{"type":"array","maxItems":50,"items":{"type":"string","minLength":1,"maxLength":100},"uniqueItems":true}},"required":["task_id"],"additionalProperties":false,"minProperties":2}"#,
        requiresUserConfirmation: true
    )
    private let taskService: any TaskOperating
    init(taskService: any TaskOperating) { self.taskService = taskService }
    func execute(input: Data) async throws -> Data {
        let request: UpdateTaskToolInput
        do { request = try JSONDecoder().decode(UpdateTaskToolInput.self, from: input) } catch {
            throw ApplicationToolError.invalidInput
        }
        guard request.hasChanges else { throw ApplicationToolError.invalidInput }
        let patch = TodoistTaskPatch(
            content: request.content.map(TaskField.set) ?? .unchanged,
            description: request.description.map(TaskField.set) ?? .unchanged,
            dueDate: request.dueDate.wasProvided
                ? request.dueDate.value.map(TaskField.set) ?? .clear : .unchanged,
            priority: request.priority.map(TaskField.set) ?? .unchanged,
            labels: request.labels.map(TaskField.set) ?? .unchanged
        )
        return try JSONEncoder().encode(
            await taskService.updateTask(id: request.taskID, patch: patch))
    }
}

final class ReopenTodoistTaskTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_reopen_task",
        description:
            "Reopen one completed Todoist task by task_id. Discover the exact ID; requires DayPlan confirmation.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"task_id":{"type":"string","minLength":1}},"required":["task_id"],"additionalProperties":false}"#,
        requiresUserConfirmation: true
    )
    private let taskService: any TaskOperating
    init(taskService: any TaskOperating) { self.taskService = taskService }
    func execute(input: Data) async throws -> Data {
        let request: TaskIDToolInput
        do { request = try JSONDecoder().decode(TaskIDToolInput.self, from: input) } catch {
            throw ApplicationToolError.invalidInput
        }
        try await taskService.reopenTask(id: request.taskID)
        return Data("{\"reopened\":true}".utf8)
    }
}

final class DeleteTodoistTaskTool: ApplicationTool, Sendable {
    let specification = ApplicationToolSpecification(
        name: "todoist_delete_task",
        description:
            "Permanently delete one Todoist task by task_id. Todoist also deletes all of its subtasks. DayPlan always shows a separate confirmation stating this consequence.",
        inputSchemaJSON:
            #"{"type":"object","properties":{"task_id":{"type":"string","minLength":1}},"required":["task_id"],"additionalProperties":false}"#,
        requiresUserConfirmation: true
    )
    private let taskService: any TaskOperating
    init(taskService: any TaskOperating) { self.taskService = taskService }
    func execute(input: Data) async throws -> Data {
        let request: TaskIDToolInput
        do { request = try JSONDecoder().decode(TaskIDToolInput.self, from: input) } catch {
            throw ApplicationToolError.invalidInput
        }
        try await taskService.deleteTask(id: request.taskID)
        return Data("{\"deleted\":true,\"subtasks_also_deleted\":true}".utf8)
    }
}

private struct EmptyToolInput: Decodable {}

private struct ListTasksToolInput: Decodable {
    let limit: Int?
    let projectID: String?
    private enum CodingKeys: String, CodingKey { case limit; case projectID = "project_id" }
}

private struct TaskIDToolInput: Decodable {
    let taskID: String
    private enum CodingKeys: String, CodingKey { case taskID = "task_id" }
}

private struct CreateTaskToolInput: Decodable {
    let content: String
    let description: String?
    let projectID: String?
    let dueDate: String?
    let priority: Int?
    let labels: [String]?

    private enum CodingKeys: String, CodingKey {
        case content
        case description
        case projectID = "project_id"
        case dueDate = "due_date"
        case priority
        case labels
    }
}

private struct CompleteTaskToolInput: Decodable {
    let taskID: String

    private enum CodingKeys: String, CodingKey {
        case taskID = "task_id"
    }
}

private struct UpdateTaskToolInput: Decodable {
    let taskID: String
    let content: String?
    let description: String?
    let dueDate: ProvidedValue<String>
    let priority: Int?
    let labels: [String]?

    var hasChanges: Bool {
        content != nil || description != nil || dueDate.wasProvided || priority != nil
            || labels != nil
    }

    private enum CodingKeys: String, CodingKey {
        case taskID = "task_id"; case content; case description; case dueDate = "due_date";
        case priority; case labels
    }
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        taskID = try container.decode(String.self, forKey: .taskID)
        content = try container.decodeIfPresent(String.self, forKey: .content)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        priority = try container.decodeIfPresent(Int.self, forKey: .priority)
        labels = try container.decodeIfPresent([String].self, forKey: .labels)
        if container.contains(.dueDate) {
            dueDate = ProvidedValue(
                wasProvided: true,
                value: try container.decodeIfPresent(String.self, forKey: .dueDate))
        } else {
            dueDate = ProvidedValue(wasProvided: false, value: nil)
        }
    }
}

private struct ProvidedValue<Value: Decodable>: Decodable {
    let wasProvided: Bool
    let value: Value?
}
