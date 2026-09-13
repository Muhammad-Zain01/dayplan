import Foundation
import SwiftUI

@MainActor
final class AppContainer: ObservableObject {
    @Published private(set) var isBootstrapped = false
    @Published private(set) var bootstrapError: String?

    let credentialSettings: CredentialSettingsViewModel
    let taskList: TaskListViewModel
    let applicationTools: ApplicationToolRegistry

    private let databaseBootstrapper: DatabaseBootstrapper
    private var bootstrapTask: Task<Void, Never>?

    init() {
        let credentialStore = KeychainCredentialStore(service: "com.dayplan.app")
        let todoistClient = TodoistAPIClient(credentialStore: credentialStore)
        let taskService = TodoistTaskService(provider: todoistClient)

        applicationTools = ApplicationToolRegistry(tools: [
            ListTodoistTasksTool(taskService: taskService),
            ListTodoistProjectsTool(taskService: taskService),
            ListTodoistLabelsTool(taskService: taskService),
            GetTodoistTaskTool(taskService: taskService),
            CreateTodoistTaskTool(taskService: taskService),
            UpdateTodoistTaskTool(taskService: taskService),
            CompleteTodoistTaskTool(taskService: taskService),
            ReopenTodoistTaskTool(taskService: taskService),
            DeleteTodoistTaskTool(taskService: taskService),
        ])

        credentialSettings = CredentialSettingsViewModel(
            credentialStore: credentialStore,
            todoistService: taskService
        )
        taskList = TaskListViewModel(taskService: taskService)
        databaseBootstrapper = DatabaseBootstrapper(
            databaseURL: AppStorageLocation.databaseURL
        )
    }

    func bootstrap() async {
        guard !isBootstrapped, bootstrapTask == nil else {
            await bootstrapTask?.value
            return
        }

        bootstrapTask = Task {
            defer { bootstrapTask = nil }
            do {
                try await databaseBootstrapper.prepare()
                isBootstrapped = true
                Task {
                    await credentialSettings.refreshStatuses()
                }
            } catch {
                bootstrapError =
                    "DayPlan couldn't initialize its local database. Check that your Application Support folder is available, then restart the app."
            }
        }
        await bootstrapTask?.value
    }
}
