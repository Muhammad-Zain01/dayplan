import Foundation

struct TodoistTask: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let content: String
    let description: String
    let dueDate: String?
    let priority: Int
    let projectID: String?
    let labels: [String]

    init(
        id: String, content: String, description: String = "", dueDate: String? = nil,
        priority: Int = 1,
        projectID: String? = nil,
        labels: [String] = []
    ) {
        self.id = id
        self.content = content
        self.description = description
        self.dueDate = dueDate
        self.priority = priority
        self.projectID = projectID
        self.labels = labels
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case content
        case description
        case due
        case dueDate = "due_date"
        case priority
        case projectID = "project_id"
        case labels
    }

    private struct Due: Decodable {
        let date: String
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        content = try container.decode(String.self, forKey: .content)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        dueDate =
            try container.decodeIfPresent(String.self, forKey: .dueDate)
            ?? container.decodeIfPresent(Due.self, forKey: .due)?.date
        priority = try container.decodeIfPresent(Int.self, forKey: .priority) ?? 1
        projectID = try container.decodeIfPresent(String.self, forKey: .projectID)
        labels = try container.decodeIfPresent([String].self, forKey: .labels) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(content, forKey: .content)
        try container.encode(description, forKey: .description)
        try container.encodeIfPresent(dueDate, forKey: .dueDate)
        try container.encode(priority, forKey: .priority)
        try container.encodeIfPresent(projectID, forKey: .projectID)
        try container.encode(labels, forKey: .labels)
    }
}

struct TodoistProject: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let inboxProject: Bool?

    var isInbox: Bool {
        if let inboxProject { return inboxProject }
        return name.localizedCaseInsensitiveCompare("Inbox") == .orderedSame
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case inboxProject = "inbox_project"
    }
}

struct TodoistLabel: Codable, Identifiable, Hashable, Sendable {
    let name: String

    var id: String { name }
}

struct TodoistTaskDraft: Equatable, Sendable {
    let content: String
    let description: String
    let projectID: String?
    let dueDate: String?
    let priority: Int
    let labels: [String]

    init(
        content: String,
        description: String = "",
        projectID: String? = nil,
        dueDate: String? = nil,
        priority: Int = 1,
        labels: [String] = []
    ) {
        self.content = content
        self.description = description
        self.projectID = projectID
        self.dueDate = dueDate
        self.priority = priority
        self.labels = labels
    }
}
