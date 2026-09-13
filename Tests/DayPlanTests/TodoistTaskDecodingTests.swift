import Foundation
import Testing
@testable import DayPlan

struct TodoistTaskDecodingTests {
    @Test
    func encodesTaskCreationFieldsUsingTodoistAPINames() throws {
        let request = TodoistCreateTaskRequest(
            content: "Plan the day",
            description: "Choose three priorities",
            projectID: "project-1",
            dueDate: "2026-09-21",
            priority: 4,
            labels: ["planning"]
        )

        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]
        )

        #expect(object["content"] as? String == "Plan the day")
        #expect(object["description"] as? String == "Choose three priorities")
        #expect(object["project_id"] as? String == "project-1")
        #expect(object["due_date"] as? String == "2026-09-21")
        #expect(object["priority"] as? Int == 4)
        #expect(object["labels"] as? [String] == ["planning"])
    }

    @Test
    func encodesOnlyPatchedTaskFieldsAndPreservesExplicitDateClearing() throws {
        let request = TodoistUpdateTaskRequest(
            patch: TodoistTaskPatch(
                dueDate: .clear,
                priority: .set(4)
            )
        )
        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]
        )

        #expect(object["due_date"] is NSNull)
        #expect(object["priority"] as? Int == 4)
        #expect(object["content"] == nil)
        #expect(object["description"] == nil)
    }

    @Test
    func decodesTodoistTaskAndOptionalDueDate() throws {
        let payload = Data(
            #"{"id":"task-42","content":"Plan the day","description":"Choose three priorities","due":{"date":"2026-09-14"},"priority":3}"#
                .utf8
        )

        let task = try JSONDecoder().decode(TodoistTask.self, from: payload)

        #expect(task.id == "task-42")
        #expect(task.content == "Plan the day")
        #expect(task.description == "Choose three priorities")
        #expect(task.dueDate == "2026-09-14")
        #expect(task.priority == 3)
    }

    @Test
    func acceptsMissingOptionalTodoistFields() throws {
        let payload = Data(#"{"id":"task-7","content":"Review inbox"}"#.utf8)

        let task = try JSONDecoder().decode(TodoistTask.self, from: payload)

        #expect(task.description.isEmpty)
        #expect(task.dueDate == nil)
        #expect(task.priority == 1)
    }

    @Test
    func identifiesInboxProjectFromTodoistProjectPayload() throws {
        let payload = Data(#"{"id":"inbox-1","name":"Inbox","inbox_project":true}"#.utf8)

        let project = try JSONDecoder().decode(TodoistProject.self, from: payload)

        #expect(project.isInbox)
        #expect(project.name == "Inbox")
    }
}
