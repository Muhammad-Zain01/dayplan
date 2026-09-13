import SwiftUI

struct TaskComposerButton: View {
    @ObservedObject var viewModel: TaskListViewModel
    @State private var isShowingComposer = false

    var body: some View {
        Button {
            isShowingComposer = true
        } label: {
            Label("New Task", systemImage: "plus")
        }
        .buttonStyle(.borderedProminent)
        .sheet(isPresented: $isShowingComposer) {
            CreateTaskSheet(viewModel: viewModel)
        }
    }
}

private enum TaskComposerField: Hashable {
    case content
}

struct CreateTaskSheet: View {
    @ObservedObject var viewModel: TaskListViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: TaskComposerField?
    @State private var content = ""
    @State private var taskDescription = ""
    @State private var selectedProjectID: String?
    @State private var dueDate: Date?
    @State private var selectedPriority = 1
    @State private var selectedLabels: Set<String> = []
    @State private var isShowingDatePicker = false

    private let priorities = [
        (apiValue: 4, label: "P1 · Urgent", color: Color.red),
        (apiValue: 3, label: "P2 · High", color: Color.orange),
        (apiValue: 2, label: "P3 · Medium", color: Color.blue),
        (apiValue: 1, label: "P4 · Normal", color: Color.secondary),
    ]

    private var selectedProjectName: String {
        viewModel.projects.first(where: { $0.id == selectedProjectID })?.name ?? "Inbox"
    }

    private var selectedPriorityOption: (apiValue: Int, label: String, color: Color) {
        priorities.first(where: { $0.apiValue == selectedPriority }) ?? priorities[3]
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    taskFields
                    Divider()
                    taskOptions
                    if let error = viewModel.projectLoadErrorMessage {
                        HStack(spacing: 8) {
                            Label(
                                "Projects couldn't load. Inbox is still available.",
                                systemImage: "exclamationmark.circle"
                            )
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .help(error)

                            Button("Retry") {
                                Task { await viewModel.loadProjects() }
                            }
                            .font(.caption)
                            .buttonStyle(.link)
                        }
                    }
                    if let error = viewModel.createTaskErrorMessage {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.callout)
                            .foregroundStyle(.red)
                    }
                }
                .padding(28)
            }

            Divider()
            footer
        }
        .frame(width: 620, height: 540)
        .background(.background)
        .task {
            focusedField = .content
            async let projects: Void = viewModel.loadProjects()
            async let labels: Void = viewModel.loadLabels()
            _ = await (projects, labels)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.title2)
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, Color.accentColor)

            VStack(alignment: .leading, spacing: 2) {
                Text("Create a task")
                    .font(.headline)
                Text("Add it to your Todoist")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                    .background(.quaternary, in: Circle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.escape, modifiers: [])
            .help("Close")
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 18)
    }

    private var taskFields: some View {
        VStack(alignment: .leading, spacing: 14) {
            TextField("Task name", text: $content, axis: .vertical)
                .font(.system(size: 24, weight: .semibold))
                .textFieldStyle(.plain)
                .lineLimit(1...2)
                .focused($focusedField, equals: .content)
                .onSubmit { Task { await saveTask() } }
                .accessibilityLabel("Task name")

            ZStack(alignment: .topLeading) {
                if taskDescription.isEmpty {
                    Text("Add a description")
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 8)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $taskDescription)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 74, maxHeight: 110)
                    .accessibilityLabel("Task description")
            }
            .padding(8)
            .background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var taskOptions: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("TASK DETAILS")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .tracking(0.7)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                projectPicker
                dueDatePicker
                priorityPicker
                labelsPicker
            }
        }
    }

    private var projectPicker: some View {
        Menu {
            Button {
                selectedProjectID = nil
            } label: {
                Label {
                    Text("Inbox")
                } icon: {
                    Image(systemName: selectedProjectID == nil ? "checkmark.circle.fill" : "tray")
                }
            }

            if !viewModel.projects.filter({ !$0.isInbox }).isEmpty {
                Divider()
                ForEach(viewModel.projects.filter { !$0.isInbox }) { project in
                    Button {
                        selectedProjectID = project.id
                    } label: {
                        Label {
                            Text(project.name)
                        } icon: {
                            Image(
                                systemName: selectedProjectID == project.id
                                    ? "checkmark.circle.fill" : "folder")
                        }
                    }
                }
            }

            if viewModel.isLoadingProjects {
                Divider()
                Text("Loading projects…")
            }
        } label: {
            optionLabel(
                title: "Project",
                value: selectedProjectName,
                symbol: selectedProjectID == nil ? "tray" : "folder"
            )
        }
        .menuStyle(.borderlessButton)
        .accessibilityLabel("Project, \(selectedProjectName)")
    }

    private var dueDatePicker: some View {
        Button {
            isShowingDatePicker.toggle()
        } label: {
            optionLabel(
                title: "Due date",
                value: dueDate.map(Self.dateLabel) ?? "No date",
                symbol: "calendar"
            )
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isShowingDatePicker, arrowEdge: .bottom) {
            VStack(spacing: 12) {
                DatePicker(
                    "Due date",
                    selection: dateBinding,
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .labelsHidden()

                HStack {
                    Button("Today") { dueDate = Calendar.current.startOfDay(for: .now) }
                    Button("Tomorrow") {
                        dueDate = Calendar.current.date(
                            byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: .now))
                    }
                    Spacer()
                    if dueDate != nil {
                        Button("Clear") { dueDate = nil }
                            .foregroundStyle(.secondary)
                    }
                    Button("Done") { isShowingDatePicker = false }
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(16)
            .frame(width: 310)
        }
        .accessibilityLabel("Due date, \(dueDate.map(Self.dateLabel) ?? "No date")")
    }

    private var priorityPicker: some View {
        Menu {
            ForEach(priorities, id: \.apiValue) { option in
                Button {
                    selectedPriority = option.apiValue
                } label: {
                    Label(option.label, systemImage: "flag.fill")
                        .foregroundStyle(option.color)
                }
            }
        } label: {
            optionLabel(
                title: "Priority",
                value: selectedPriorityOption.label,
                symbol: "flag.fill",
                symbolColor: selectedPriorityOption.color
            )
        }
        .menuStyle(.borderlessButton)
        .accessibilityLabel("Priority, \(selectedPriorityOption.label)")
    }

    private var labelsPicker: some View {
        Menu {
            if viewModel.labels.isEmpty {
                Text(viewModel.isLoadingLabels ? "Loading labels…" : "No labels available")
            }

            ForEach(viewModel.labels) { label in
                Button {
                    if selectedLabels.contains(label.name) {
                        selectedLabels.remove(label.name)
                    } else {
                        selectedLabels.insert(label.name)
                    }
                } label: {
                    Label(
                        label.name,
                        systemImage: selectedLabels.contains(label.name)
                            ? "checkmark.circle.fill" : "circle"
                    )
                }
            }

            if viewModel.labelLoadErrorMessage != nil {
                Divider()
                Button("Retry loading labels") {
                    Task { await viewModel.loadLabels() }
                }
            }
        } label: {
            optionLabel(
                title: "Labels",
                value: selectedLabels.isEmpty ? "None" : "\(selectedLabels.count) selected",
                symbol: "tag"
            )
        }
        .menuStyle(.borderlessButton)
        .accessibilityLabel("Labels, \(selectedLabels.count) selected")
    }

    private func optionLabel(
        title: String,
        value: String,
        symbol: String,
        symbolColor: Color = .accentColor
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 7) {
                Image(systemName: symbol)
                    .foregroundStyle(symbolColor)
                Text(value)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .font(.subheadline.weight(.medium))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.42), in: RoundedRectangle(cornerRadius: 10))
        .contentShape(RoundedRectangle(cornerRadius: 10))
    }

    private var footer: some View {
        HStack {
            Text("⌘ Return to create")
                .font(.caption)
                .foregroundStyle(.tertiary)

            Spacer()

            Button("Cancel") { dismiss() }
                .keyboardShortcut(.escape, modifiers: [])

            Button {
                Task { await saveTask() }
            } label: {
                if viewModel.isCreatingTask {
                    ProgressView()
                        .controlSize(.small)
                    Text("Creating…")
                } else {
                    Label("Create task", systemImage: "plus")
                }
            }
            .buttonStyle(.borderedProminent)
            .keyboardShortcut(.return, modifiers: [.command])
            .disabled(
                content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || viewModel.isCreatingTask)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
    }

    private var dateBinding: Binding<Date> {
        Binding(
            get: { dueDate ?? Calendar.current.startOfDay(for: .now) },
            set: { dueDate = $0 }
        )
    }

    private func saveTask() async {
        let draft = TodoistTaskDraft(
            content: content,
            description: taskDescription,
            projectID: selectedProjectID,
            dueDate: dueDate.map(Self.apiDateString),
            priority: selectedPriority,
            labels: Array(selectedLabels).sorted()
        )
        if await viewModel.addTask(draft: draft) {
            dismiss()
        }
    }

    private static func dateLabel(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    private static func apiDateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
