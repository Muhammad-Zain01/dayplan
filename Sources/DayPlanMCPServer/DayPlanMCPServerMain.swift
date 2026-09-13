import Foundation

@main
struct DayPlanMCPServerCommand {
    static func main() async {
        let credentialStore = KeychainCredentialStore(service: "com.dayplan.app")
        let todoistClient = TodoistAPIClient(credentialStore: credentialStore)
        let taskService = TodoistTaskService(provider: todoistClient)
        let registry = ApplicationToolRegistry(tools: [
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
        await MCPStdioServer(registry: registry).run()
    }
}
