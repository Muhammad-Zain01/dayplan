import SwiftUI

private enum AppSection: Hashable {
    case today
    case tasks
    case settings
}

struct AppRootView: View {
    @EnvironmentObject private var appContainer: AppContainer
    @State private var selection: AppSection? = .today

    var body: some View {
        Group {
            if let error = appContainer.bootstrapError {
                ContentUnavailableView(
                    "Setup couldn't finish",
                    systemImage: "externaldrive.badge.exclamationmark",
                    description: Text(error)
                )
            } else if !appContainer.isBootstrapped {
                ProgressView("Preparing DayPlan…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                NavigationSplitView {
                    List(selection: $selection) {
                        Label("Today", systemImage: "sun.max")
                            .tag(AppSection.today)
                        Label("Tasks", systemImage: "checklist")
                            .tag(AppSection.tasks)

                        Section {
                            Label("Settings", systemImage: "gearshape")
                                .tag(AppSection.settings)
                        }
                    }
                    .navigationTitle("DayPlan")
                    .listStyle(.sidebar)
                } detail: {
                    detailView
                }
                .navigationSplitViewStyle(.balanced)
            }
        }
        .frame(minWidth: 760, minHeight: 520)
    }

    @ViewBuilder
    private var detailView: some View {
        switch selection ?? .today {
        case .today:
            TodayView(taskList: appContainer.taskList)
        case .tasks:
            TaskListView(viewModel: appContainer.taskList)
        case .settings:
            SettingsView(viewModel: appContainer.credentialSettings)
        }
    }
}
