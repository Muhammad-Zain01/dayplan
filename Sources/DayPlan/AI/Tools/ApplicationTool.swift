import Foundation

struct ApplicationToolSpecification: Equatable, Sendable {
    let name: String
    let description: String
    let inputSchemaJSON: String
    let requiresUserConfirmation: Bool
}

protocol ApplicationTool: Sendable {
    var specification: ApplicationToolSpecification { get }
    func execute(input: Data) async throws -> Data
}

actor ApplicationToolRegistry {
    private let toolsByName: [String: any ApplicationTool]

    init(tools: [any ApplicationTool]) {
        toolsByName = Dictionary(
            tools.map { ($0.specification.name, $0) },
            uniquingKeysWith: { first, _ in first }
        )
    }

    func specifications() -> [ApplicationToolSpecification] {
        toolsByName.values.map(\.specification).sorted { $0.name < $1.name }
    }

    func execute(
        name: String,
        input: Data,
        approval: ToolApproval = .notRequired
    ) async throws -> Data {
        guard let tool = toolsByName[name] else {
            throw ApplicationToolError.unknownTool(name)
        }
        try Self.validate(input: input, against: tool.specification.inputSchemaJSON)
        if tool.specification.requiresUserConfirmation, approval != .confirmedByUser {
            throw ApplicationToolError.confirmationRequired
        }
        return try await tool.execute(input: input)
    }

    private static func validate(input: Data, against schemaJSON: String) throws {
        guard
            let schema = try JSONSerialization.jsonObject(with: Data(schemaJSON.utf8)) as? [String: Any],
            let payload = try JSONSerialization.jsonObject(with: input) as? [String: Any]
        else { throw ApplicationToolError.invalidInput }
        let properties = schema["properties"] as? [String: Any] ?? [:]
        let required = schema["required"] as? [String] ?? []
        guard (schema["additionalProperties"] as? Bool != false || payload.keys.allSatisfy({ properties[$0] != nil })),
            required.allSatisfy({ payload[$0] != nil })
        else { throw ApplicationToolError.invalidInput }
    }
}

enum ToolApproval: Sendable {
    case notRequired
    case confirmedByUser
}

enum ApplicationToolError: LocalizedError, Sendable {
    case unknownTool(String)
    case invalidInput
    case confirmationRequired

    var errorDescription: String? {
        switch self {
        case .unknownTool:
            "That DayPlan tool isn't available."
        case .invalidInput:
            "The tool input couldn't be understood."
        case .confirmationRequired:
            "This action needs the user's confirmation before it can run."
        }
    }
}
