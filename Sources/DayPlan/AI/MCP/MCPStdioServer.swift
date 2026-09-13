import AppKit
import Foundation

actor MCPStdioServer {
    private let registry: ApplicationToolRegistry
    private var isInitialized = false

    init(registry: ApplicationToolRegistry) {
        self.registry = registry
    }

    func run() async {
        do {
            for try await line in FileHandle.standardInput.bytes.lines {
                guard let data = line.data(using: .utf8) else { continue }
                if data.count > 65_536 {
                    let message = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                    try Self.write(
                        Self.error(
                            id: message?["id"], code: -32600,
                            message: "Request exceeds the supported size."))
                    continue
                }
                let response = await handle(data)
                if let response { try Self.write(response) }
            }
        } catch {
            Self.writeDiagnostic("MCP stdio ended with a transport error.")
        }
    }

    private func handle(_ data: Data) async -> [String: Any]? {
        guard
            let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            message["jsonrpc"] as? String == "2.0",
            let method = message["method"] as? String
        else {
            return Self.error(id: nil, code: -32700, message: "Invalid JSON-RPC request.")
        }

        let id = message["id"]
        if id == nil {
            if method == "notifications/initialized" {
                isInitialized = true
                return nil
            }
            if method == "notifications/cancelled" { return nil }
            return nil
        }

        let requestVersion = Self.requestProtocolVersion(in: message)
        let supportedVersions = [
            "2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05",
        ]
        if let requestVersion, !supportedVersions.contains(requestVersion) {
            return Self.error(
                id: id,
                code: -32022,
                message: "This MCP protocol version is not supported.",
                data: ["requested": requestVersion, "supported": supportedVersions]
            )
        }

        if method == "server/discover" {
            guard requestVersion == "2026-07-28", Self.hasValidCurrentMetadata(in: message) else {
                return Self.error(
                    id: id, code: -32602, message: "Current MCP request metadata is required.")
            }
            return Self.success(
                id: id,
                result: [
                    "supportedVersions": supportedVersions,
                    "capabilities": ["tools": ["listChanged": false]],
                    "instructions":
                        "DayPlan exposes Todoist task tools. Every write opens a DayPlan confirmation dialog before it can run.",
                    "ttlMs": 0,
                    "cacheScope": "private",
                ])
        }

        let usesStatelessProtocol = requestVersion == "2026-07-28"
        if usesStatelessProtocol, !Self.hasValidCurrentMetadata(in: message) {
            return Self.error(
                id: id, code: -32602, message: "Current MCP request metadata is required.")
        }
        if usesStatelessProtocol, method == "initialize" {
            return Self.error(
                id: id, code: -32601, message: "The current MCP protocol does not use initialize.")
        }
        if method != "initialize", method != "ping", !isInitialized, !usesStatelessProtocol {
            return Self.error(
                id: id, code: -32002, message: "Initialize the DayPlan MCP connection first.")
        }

        switch method {
        case "initialize":
            isInitialized = true
            let parameters = message["params"] as? [String: Any] ?? [:]
            let requestedVersion = parameters["protocolVersion"] as? String
            let supportedVersions: Set<String> = [
                "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05",
            ]
            let version =
                requestedVersion.flatMap { supportedVersions.contains($0) ? $0 : nil }
                ?? "2025-11-25"
            return Self.success(
                id: id,
                result: [
                    "protocolVersion": version,
                    "capabilities": ["tools": ["listChanged": false]],
                    "serverInfo": ["name": "dayplan", "version": "0.1.0"],
                    "instructions":
                        "DayPlan exposes Todoist task tools. Read tools are immediate. Every write opens a DayPlan confirmation dialog before it can run.",
                ])
        case "ping":
            return Self.success(id: id, result: [String: String]())
        case "tools/list":
            let specifications = await registry.specifications()
            let tools: [[String: Any]] = specifications.compactMap { specification in
                guard let schemaData = specification.inputSchemaJSON.data(using: .utf8),
                    let schema = try? JSONSerialization.jsonObject(with: schemaData)
                else { return nil }
                var annotations: [String: Bool] = [
                    "readOnlyHint": !specification.requiresUserConfirmation
                ]
                if specification.name == "todoist_delete_task" {
                    annotations["destructiveHint"] = true
                }
                var tool: [String: Any] = [
                    "name": specification.name,
                    "description": specification.description,
                    "inputSchema": schema,
                    "annotations": annotations,
                ]
                if let outputSchemaJSON = specification.outputSchemaJSON
                    ?? MCPToolOutputSchema.json(for: specification.name),
                    let outputData = outputSchemaJSON.data(using: .utf8),
                    let outputSchema = try? JSONSerialization.jsonObject(with: outputData)
                {
                    tool["outputSchema"] = outputSchema
                }
                return tool
            }
            return Self.success(
                id: id,
                result: [
                    "tools": tools,
                    "ttlMs": 0,
                    "cacheScope": "private",
                ])
        case "tools/call":
            return await callTool(id: id, params: message["params"] as? [String: Any] ?? [:])
        default:
            return Self.error(id: id, code: -32601, message: "Method not found.")
        }
    }

    private static func requestProtocolVersion(in message: [String: Any]) -> String? {
        let params = message["params"] as? [String: Any]
        let metadata = params?["_meta"] as? [String: Any]
        return metadata?["io.modelcontextprotocol/protocolVersion"] as? String
    }

    private static func hasValidCurrentMetadata(in message: [String: Any]) -> Bool {
        guard requestProtocolVersion(in: message) == "2026-07-28",
            let params = message["params"] as? [String: Any],
            let metadata = params["_meta"] as? [String: Any],
            metadata["io.modelcontextprotocol/clientCapabilities"] is [String: Any]
        else { return false }
        return true
    }

    private func callTool(id: Any?, params: [String: Any]) async -> [String: Any] {
        guard let name = params["name"] as? String else {
            return Self.error(id: id, code: -32602, message: "Tool name is required.")
        }
        let arguments = params["arguments"] as? [String: Any] ?? [:]
        guard JSONSerialization.isValidJSONObject(arguments),
            let input = try? JSONSerialization.data(
                withJSONObject: arguments, options: [.sortedKeys])
        else {
            return Self.error(
                id: id, code: -32602, message: "Tool arguments must be a JSON object.")
        }

        do {
            let specifications = await registry.specifications()
            guard let specification = specifications.first(where: { $0.name == name }) else {
                throw ApplicationToolError.unknownTool(name)
            }
            try await registry.validate(name: name, input: input)
            let approval: ToolApproval
            if specification.requiresUserConfirmation {
                let encodedArguments =
                    (try? JSONSerialization.data(
                        withJSONObject: arguments, options: [.prettyPrinted, .sortedKeys]))
                    .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                let approved = await ToolApprovalDialog.confirm(
                    toolName: name, encodedArguments: encodedArguments)
                guard approved else {
                    return Self.toolError(
                        id: id, message: "The user declined or did not approve this action.")
                }
                approval = .confirmedByUser
            } else {
                approval = .notRequired
            }
            let output = try await registry.execute(name: name, input: input, approval: approval)
            let structured = try JSONSerialization.jsonObject(
                with: output, options: [.fragmentsAllowed])
            let displayText = String(data: output, encoding: .utf8) ?? "The action completed."
            return Self.success(
                id: id,
                result: [
                    "content": [["type": "text", "text": displayText]],
                    "structuredContent": structured,
                    "isError": false,
                ])
        } catch {
            return Self.toolError(id: id, message: Self.safeMessage(for: error))
        }
    }

    private static func safeMessage(for error: Error) -> String {
        if let appError = error as? ApplicationToolError { return appError.localizedDescription }
        if let apiError = error as? TodoistAPIError { return apiError.localizedDescription }
        if error is DecodingError { return "Todoist returned an unexpected response." }
        return "The Todoist action could not be completed. Check the connection and try again."
    }

    private static func success(id: Any?, result: [String: Any]) -> [String: Any] {
        var completeResult = result
        completeResult["resultType"] = "complete"
        completeResult["_meta"] = [
            "io.modelcontextprotocol/serverInfo": ["name": "dayplan", "version": "0.1.0"]
        ]
        return ["jsonrpc": "2.0", "id": id ?? NSNull(), "result": completeResult]
    }

    private static func error(
        id: Any?, code: Int, message: String, data: [String: Any]? = nil
    ) -> [String: Any] {
        var errorObject: [String: Any] = ["code": code, "message": message]
        errorObject["data"] = data
        return ["jsonrpc": "2.0", "id": id ?? NSNull(), "error": errorObject]
    }

    private static func toolError(id: Any?, message: String) -> [String: Any] {
        success(
            id: id,
            result: [
                "content": [["type": "text", "text": message]],
                "isError": true,
            ])
    }

    private static func write(_ response: [String: Any]) throws {
        var data = try JSONSerialization.data(
            withJSONObject: response, options: [.sortedKeys, .fragmentsAllowed])
        data.append(0x0A)
        try FileHandle.standardOutput.write(contentsOf: data)
    }

    private static func writeDiagnostic(_ message: String) {
        guard let data = (message + "\n").data(using: .utf8) else { return }
        try? FileHandle.standardError.write(contentsOf: data)
    }
}

private enum MCPToolOutputSchema {
    static func json(for toolName: String) -> String? {
        switch toolName {
        case "todoist_list_tasks":
            return
                #"{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"content":{"type":"string"},"description":{"type":"string"},"due_date":{"type":["string","null"]},"priority":{"type":"integer"},"project_id":{"type":["string","null"]},"labels":{"type":"array","items":{"type":"string"}}},"required":["id","content","description","priority","labels"]}}"#
        case "todoist_get_task", "todoist_create_task", "todoist_update_task":
            return
                #"{"type":"object","properties":{"id":{"type":"string"},"content":{"type":"string"},"description":{"type":"string"},"due_date":{"type":["string","null"]},"priority":{"type":"integer"},"project_id":{"type":["string","null"]},"labels":{"type":"array","items":{"type":"string"}}},"required":["id","content","description","priority","labels"]}"#
        case "todoist_list_projects":
            return
                #"{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"inbox_project":{"type":["boolean","null"]}},"required":["id","name"]}}"#
        case "todoist_list_labels":
            return
                #"{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}}"#
        case "todoist_complete_task":
            return
                #"{"type":"object","properties":{"completed":{"type":"boolean"}},"required":["completed"]}"#
        case "todoist_reopen_task":
            return
                #"{"type":"object","properties":{"reopened":{"type":"boolean"}},"required":["reopened"]}"#
        case "todoist_delete_task":
            return
                #"{"type":"object","properties":{"deleted":{"type":"boolean"},"subtasks_also_deleted":{"type":"boolean"}},"required":["deleted","subtasks_also_deleted"]}"#
        default: return nil
        }
    }
}

@MainActor
private enum ToolApprovalDialog {
    static func confirm(toolName: String, encodedArguments: String) -> Bool {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = title(for: toolName)
        alert.informativeText = detail(for: toolName, encodedArguments: encodedArguments)
        alert.addButton(withTitle: toolName == "todoist_delete_task" ? "Delete Task" : "Approve")
        alert.addButton(withTitle: "Cancel")
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        return alert.runModal() == .alertFirstButtonReturn
    }

    private static func title(for name: String) -> String {
        switch name {
        case "todoist_create_task": return "Allow DayPlan to create this Todoist task?"
        case "todoist_update_task": return "Allow DayPlan to update this Todoist task?"
        case "todoist_complete_task": return "Allow DayPlan to complete this Todoist task?"
        case "todoist_reopen_task": return "Allow DayPlan to reopen this Todoist task?"
        case "todoist_delete_task": return "Permanently delete this Todoist task?"
        default: return "Allow DayPlan to make this change?"
        }
    }

    private static func detail(for name: String, encodedArguments: String) -> String {
        let consequence =
            name == "todoist_delete_task"
            ? "\n\nTodoist will also delete every subtask belonging to this task." : ""
        return "Requested action: \(name)\n\nExact arguments:\n\(encodedArguments)\(consequence)"
    }
}
