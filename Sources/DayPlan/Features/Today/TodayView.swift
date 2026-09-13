import SwiftUI

struct TodayView: View {
    @ObservedObject var taskList: TaskListViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(Date.now, format: .dateTime.weekday(.wide).month(.wide).day())
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("Today")
                        .font(.largeTitle.weight(.semibold))
                }
                Spacer()
                TaskComposerButton(viewModel: taskList)
            }

            if taskList.tasks.isEmpty && !taskList.isLoading {
                ContentUnavailableView(
                    "Your day starts here",
                    systemImage: "sun.max",
                    description: Text(
                        "Connect Todoist in Settings to bring your tasks into DayPlan.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                TaskRowsView(viewModel: taskList)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            await taskList.loadTasks()
        }
    }
}
