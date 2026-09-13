import SwiftUI

@main
@MainActor
struct DayPlanApp: App {
    @StateObject private var appContainer: AppContainer

    init() {
        _appContainer = StateObject(wrappedValue: AppContainer())
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(appContainer)
                .task {
                    await appContainer.bootstrap()
                }
        }
        .defaultSize(width: 1040, height: 720)
        .commands {
            SidebarCommands()
        }
    }
}
