import SwiftUI

struct TaskListView: View {
    @ObservedObject var viewModel: TaskListViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .firstTextBaseline) {
                Text("Tasks")
                    .font(.largeTitle.weight(.semibold))
                Spacer()
                TaskComposerButton(viewModel: viewModel)
                Button {
                    Task { await viewModel.loadTasks() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(viewModel.isLoading)
            }

            if let message = viewModel.statusMessage {
                Text(message)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            if let error = viewModel.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.callout)
                    .foregroundStyle(.red)
            }

            if viewModel.isLoading && viewModel.tasks.isEmpty {
                ProgressView("Loading tasks…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.tasks.isEmpty {
                ContentUnavailableView(
                    "No tasks to show",
                    systemImage: "checklist",
                    description: Text(
                        "Add a task above or connect your Todoist account in Settings.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                TaskRowsView(viewModel: viewModel)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            await viewModel.loadTasks()
        }
    }
}

struct TaskRowsView: View {
    @ObservedObject var viewModel: TaskListViewModel

    var body: some View {
        List(viewModel.tasks) { task in
            HStack(spacing: 12) {
                Button {
                    Task { await viewModel.complete(task) }
                } label: {
                    Image(systemName: "circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Complete task in Todoist")

                VStack(alignment: .leading, spacing: 3) {
                    Text(task.content)
                        .lineLimit(2)
                    if !task.description.isEmpty {
                        Text(task.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if let dueDate = task.dueDate {
                    Text(dueDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 3)
        }
        .listStyle(.inset)
    }
}
