import Foundation
import SwiftUI

@MainActor
final class TaskListViewModel: ObservableObject {
    @Published private(set) var tasks: [TodoistTask] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var statusMessage: String?
    @Published private(set) var projects: [TodoistProject] = []
    @Published private(set) var isLoadingProjects = false
    @Published private(set) var projectLoadErrorMessage: String?
    @Published private(set) var labels: [TodoistLabel] = []
    @Published private(set) var isLoadingLabels = false
    @Published private(set) var labelLoadErrorMessage: String?
    @Published private(set) var isCreatingTask = false
    @Published private(set) var createTaskErrorMessage: String?

    private let taskService: TaskOperating

    init(taskService: TaskOperating) {
        self.taskService = taskService
    }

    func loadTasks() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        statusMessage = nil
        defer { isLoading = false }

        do {
            tasks = try await taskService.listTasks()
        } catch {
            errorMessage = userFacingMessage(for: error)
        }
    }

    func loadProjects() async {
        guard !isLoadingProjects else { return }
        isLoadingProjects = true
        projectLoadErrorMessage = nil
        defer { isLoadingProjects = false }
        do {
            projects = try await taskService.listProjects()
        } catch {
            projectLoadErrorMessage = userFacingMessage(for: error)
        }
    }

    func loadLabels() async {
        guard !isLoadingLabels else { return }
        isLoadingLabels = true
        labelLoadErrorMessage = nil
        defer { isLoadingLabels = false }
        do {
            labels = try await taskService.listLabels()
        } catch {
            labelLoadErrorMessage = userFacingMessage(for: error)
        }
    }

    func addTask(draft: TodoistTaskDraft) async -> Bool {
        guard !isCreatingTask else { return false }
        isCreatingTask = true
        createTaskErrorMessage = nil
        statusMessage = nil
        defer { isCreatingTask = false }

        do {
            let createdTask = try await taskService.createTask(draft: draft)
            tasks.insert(createdTask, at: 0)
            statusMessage = "Added to Todoist."
            return true
        } catch {
            createTaskErrorMessage = userFacingMessage(for: error)
            return false
        }
    }

    func complete(_ task: TodoistTask) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        statusMessage = nil
        defer { isLoading = false }

        do {
            try await taskService.completeTask(id: task.id)
            tasks.removeAll { $0.id == task.id }
            statusMessage = "Completed in Todoist."
        } catch {
            errorMessage = userFacingMessage(for: error)
        }
    }

    private func userFacingMessage(for error: Error) -> String {
        if let todoistError = error as? TodoistAPIError {
            return todoistError.localizedDescription
        }
        return
            "Couldn't finish that Todoist request. Check your connection and Todoist settings, then try again."
    }
}
