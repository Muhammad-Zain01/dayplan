import Foundation
import Testing
@testable import DayPlan

struct DatabaseMigratorTests {
    @Test
    func appliesInitialSchemaAndIsSafeToRunAgain() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("dayplan-tests-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("dayplan.sqlite3")
        defer { try? FileManager.default.removeItem(at: databaseURL.deletingLastPathComponent()) }

        let database = try SQLiteDatabase(url: databaseURL)
        let migrator = DatabaseMigrator(database: database)

        try migrator.migrate()
        try migrator.migrate()

        #expect(try database.integer(for: "PRAGMA user_version") == 1)
        #expect(FileManager.default.fileExists(atPath: databaseURL.path))
    }
}
