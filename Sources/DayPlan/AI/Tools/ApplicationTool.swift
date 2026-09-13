import Foundation
import CoreFoundation

struct ApplicationToolSpecification: Equatable, Sendable {
    let name: String
    let description: String
    let inputSchemaJSON: String
    let outputSchemaJSON: String?
    let requiresUserConfirmation: Bool

    init(
        name: String,
        description: String,
        inputSchemaJSON: String,
        outputSchemaJSON: String? = nil,
        requiresUserConfirmation: Bool
    ) {
        self.name = name
        self.description = description
        self.inputSchemaJSON = inputSchemaJSON
        self.outputSchemaJSON = outputSchemaJSON
        self.requiresUserConfirmation = requiresUserConfirmation
    }
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

    func validate(name: String, input: Data) throws {
        guard let tool = toolsByName[name] else {
            throw ApplicationToolError.unknownTool(name)
        }
        try Self.validate(input: input, against: tool.specification.inputSchemaJSON)
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
            let schema = try JSONSerialization.jsonObject(with: Data(schemaJSON.utf8))
                as? [String: Any],
            let payload = try JSONSerialization.jsonObject(with: input) as? [String: Any]
        else { throw ApplicationToolError.invalidInput }
        let properties = schema["properties"] as? [String: Any] ?? [:]
        let required = schema["required"] as? [String] ?? []
        let minimumProperties = schema["minProperties"] as? Int ?? 0
        guard
            (schema["additionalProperties"] as? Bool != false
                || payload.keys.allSatisfy({ properties[$0] != nil })),
            required.allSatisfy({ payload[$0] != nil }),
            payload.count >= minimumProperties,
            payload.allSatisfy({ key, value in
                guard let property = properties[key] as? [String: Any] else { return false }
                return Self.matches(value, schema: property)
            })
        else { throw ApplicationToolError.invalidInput }
    }

    private static func matches(_ value: Any, schema: [String: Any]) -> Bool {
        let allowedTypes = schema["type"] as? [String] ?? [schema["type"] as? String ?? ""]
        if value is NSNull { return allowedTypes.contains("null") }
        let isString = value is String
        let isArray = value is [Any]
        let isObject = value is [String: Any]
        let number = value as? NSNumber
        // JSONSerialization bridges booleans and numbers through NSNumber. CFGetTypeID distinguishes them.
        let isJSONBoolean = number.map { CFGetTypeID($0) == CFBooleanGetTypeID() } ?? false
        let isInteger =
            number.map { !isJSONBoolean && floor($0.doubleValue) == $0.doubleValue } ?? false
        let matchesType = allowedTypes.contains { type in
            switch type {
            case "string": return isString
            case "integer": return isInteger
            case "number": return number != nil && !isJSONBoolean
            case "boolean": return isJSONBoolean
            case "array": return isArray
            case "object": return isObject
            default: return false
            }
        }
        guard matchesType else { return false }
        if let string = value as? String {
            if let minimum = schema["minLength"] as? Int, string.count < minimum { return false }
            if let maximum = schema["maxLength"] as? Int, string.count > maximum { return false }
            if schema["format"] as? String == "date" {
                let pieces = string.split(separator: "-", omittingEmptySubsequences: false)
                guard pieces.count == 3, pieces[0].count == 4, pieces[1].count == 2,
                    pieces[2].count == 2,
                    pieces.allSatisfy({ $0.allSatisfy(\.isNumber) })
                else { return false }
            }
        }
        if let integer = number, isInteger {
            if let minimum = schema["minimum"] as? Double, integer.doubleValue < minimum {
                return false
            }
            if let maximum = schema["maximum"] as? Double, integer.doubleValue > maximum {
                return false
            }
            if let minimum = schema["minimum"] as? Int, integer.intValue < minimum { return false }
            if let maximum = schema["maximum"] as? Int, integer.intValue > maximum { return false }
        }
        if let array = value as? [Any], let itemSchema = schema["items"] as? [String: Any] {
            if let maximum = schema["maxItems"] as? Int, array.count > maximum { return false }
            if let unique = schema["uniqueItems"] as? Bool, unique,
                Set(array.map { String(describing: $0) }).count != array.count
            {
                return false
            }
            return array.allSatisfy { matches($0, schema: itemSchema) }
        }
        return true
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
