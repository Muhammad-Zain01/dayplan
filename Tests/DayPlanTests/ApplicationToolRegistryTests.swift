import Foundation
import Testing
@testable import DayPlan

struct ApplicationToolRegistryTests {
    @Test
    func exposesTaskToolsWithValidJSONSchemas() async throws {
        let provider = StubTodoistProvider()
        let taskService = TodoistTaskService(provider: provider)
        let registry = ApplicationToolRegistry(tools: [
            ListTodoistTasksTool(taskService: taskService),
            ListTodoistProjectsTool(taskService: taskService),
            ListTodoistLabelsTool(taskService: taskService),
            CreateTodoistTaskTool(taskService: taskService),
            CompleteTodoistTaskTool(taskService: taskService),
        ])

        let specifications = await registry.specifications()

        #expect(
            specifications.map(\.name) == [
                "todoist_complete_task",
                "todoist_create_task",
                "todoist_list_labels",
                "todoist_list_projects",
                "todoist_list_tasks",
            ])
        for specification in specifications {
            let schema = try JSONSerialization.jsonObject(
                with: Data(specification.inputSchemaJSON.utf8))
            #expect(schema is [String: Any])
        }
    }

    @Test
    func createToolUsesSharedTaskServiceAndReturnsTheCreatedTask() async throws {
        let provider = StubTodoistProvider()
        let taskService = TodoistTaskService(provider: provider)
        let registry = ApplicationToolRegistry(tools: [
            CreateTodoistTaskTool(taskService: taskService)
        ])
        let input = Data(
            #"{"content":"  Plan the day  ","description":" Pick three priorities ","project_id":"work","due_date":"2026-09-21","priority":4,"labels":["planning"]}"#
                .utf8
        )

        let output = try await registry.execute(
            name: "todoist_create_task",
            input: input,
            approval: .confirmedByUser
        )
        let task = try JSONDecoder().decode(TodoistTask.self, from: output)

        #expect(task.content == "Plan the day")
        let draft = await provider.lastCreatedDraft()
        #expect(draft?.content == "Plan the day")
        #expect(draft?.description == "Pick three priorities")
        #expect(draft?.projectID == "work")
        #expect(draft?.dueDate == "2026-09-21")
        #expect(draft?.priority == 4)
        #expect(draft?.labels == ["planning"])
    }

    @Test
    func createTaskRejectsPriorityOutsideTodoistRange() async throws {
        let provider = StubTodoistProvider()
        let taskService = TodoistTaskService(provider: provider)
        do {
            _ = try await taskService.createTask(
                draft: TodoistTaskDraft(content: "Plan the day", priority: 5))
            Issue.record("An invalid Todoist priority was accepted.")
        } catch let error as TaskServiceError {
            if case .invalidPriority = error {
                #expect(await provider.lastCreatedDraft() == nil)
            } else {
                Issue.record("Unexpected task service error: \(error)")
            }
        }
    }

    @Test
    func blocksTaskMutationWithoutExplicitApproval() async throws {
        let provider = StubTodoistProvider()
        let taskService = TodoistTaskService(provider: provider)
        let registry = ApplicationToolRegistry(tools: [
            CreateTodoistTaskTool(taskService: taskService)
        ])
        let input = Data(#"{"content":"Plan the day"}"#.utf8)

        do {
            _ = try await registry.execute(name: "todoist_create_task", input: input)
            Issue.record("A task mutation ran without user approval.")
        } catch let error as ApplicationToolError {
            if case .confirmationRequired = error {
                #expect(await provider.lastCreatedDraft() == nil)
            } else {
                Issue.record("Unexpected tool error: \(error)")
            }
        }
    }
}

private actor StubTodoistProvider: TodoistTaskProviding {
    private var createdDraft: TodoistTaskDraft?

    func listTasks() async throws -> [TodoistTask] { [] }

    func listProjects() async throws -> [TodoistProject] {
        [TodoistProject(id: "inbox", name: "Inbox", inboxProject: true)]
    }

    func listLabels() async throws -> [TodoistLabel] {
        [TodoistLabel(name: "planning")]
    }

    func createTask(draft: TodoistTaskDraft) async throws -> TodoistTask {
        createdDraft = draft
        return TodoistTask(
            id: "stub-task",
            content: draft.content,
            description: draft.description,
            dueDate: draft.dueDate,
            priority: draft.priority
        )
    }

    func completeTask(id: String) async throws {}

    func lastCreatedDraft() -> TodoistTaskDraft? { createdDraft }
}
