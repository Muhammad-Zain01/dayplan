import Foundation

final class DatabaseMigrator: Sendable {
    private let database: SQLiteDatabase

    init(database: SQLiteDatabase) {
        self.database = database
    }

    func migrate() throws {
        let currentVersion = try database.integer(for: "PRAGMA user_version")
        guard currentVersion <= 1 else {
            throw DatabaseMigrationError.unsupportedSchemaVersion(currentVersion)
        }
        guard currentVersion < 1 else { return }

        try database.applyMigration(
            version: 1,
            statements: [
                "CREATE TABLE app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
                "CREATE TABLE todoist_task_cache (id TEXT PRIMARY KEY NOT NULL, content TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', due_date TEXT, priority INTEGER NOT NULL DEFAULT 1, checked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)",
                "CREATE INDEX idx_todoist_task_cache_due_date ON todoist_task_cache(due_date)",
            ]
        )
    }
}

enum DatabaseMigrationError: Error, Sendable {
    case unsupportedSchemaVersion(Int64)
}

final class DatabaseBootstrapper: Sendable {
    private let databaseURL: URL

    init(databaseURL: URL) {
        self.databaseURL = databaseURL
    }

    func prepare() async throws {
        let targetURL = databaseURL
        try await Task.detached(priority: .utility) {
            let database = try SQLiteDatabase(url: targetURL)
            try DatabaseMigrator(database: database).migrate()
        }.value
    }
}
