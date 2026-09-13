import CSQLite
import Foundation

enum SQLiteValue: Sendable {
    case text(String)
    case integer(Int64)
    case null
}

final class SQLiteDatabase: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.dayplan.sqlite", qos: .utility)
    private var connection: OpaquePointer?

    init(url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        var database: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        let status = sqlite3_open_v2(url.path, &database, flags, nil)
        guard status == SQLITE_OK, let database else {
            let message =
                database.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown SQLite error"
            if let database { sqlite3_close_v2(database) }
            throw SQLiteDatabaseError.openFailed(message)
        }

        connection = database
        sqlite3_busy_timeout(database, 5_000)
        try execute("PRAGMA journal_mode = WAL")
        try execute("PRAGMA foreign_keys = ON")
    }

    deinit {
        if let connection {
            sqlite3_close_v2(connection)
        }
    }

    func integer(for sql: String) throws -> Int64 {
        try queue.sync {
            let statement = try prepare(sql)
            defer { sqlite3_finalize(statement) }

            let status = sqlite3_step(statement)
            guard status == SQLITE_ROW else {
                throw makeError(status)
            }
            return sqlite3_column_int64(statement, 0)
        }
    }

    func execute(_ sql: String, values: [SQLiteValue] = []) throws {
        try queue.sync {
            let statement = try prepare(sql)
            defer { sqlite3_finalize(statement) }
            try bind(values, to: statement)

            var status = sqlite3_step(statement)
            while status == SQLITE_ROW {
                status = sqlite3_step(statement)
            }
            guard status == SQLITE_DONE else {
                throw makeError(status)
            }
        }
    }

    func applyMigration(version: Int, statements: [String]) throws {
        try queue.sync {
            try executeOnQueue("BEGIN IMMEDIATE")
            do {
                for statement in statements {
                    try executeOnQueue(statement)
                }
                try executeOnQueue("PRAGMA user_version = \(version)")
                try executeOnQueue("COMMIT")
            } catch {
                try? executeOnQueue("ROLLBACK")
                throw error
            }
        }
    }

    private func prepare(_ sql: String) throws -> OpaquePointer {
        guard let connection else {
            throw SQLiteDatabaseError.connectionClosed
        }
        var statement: OpaquePointer?
        let status = sqlite3_prepare_v2(connection, sql, -1, &statement, nil)
        guard status == SQLITE_OK, let statement else {
            throw makeError(status)
        }
        return statement
    }

    private func bind(_ values: [SQLiteValue], to statement: OpaquePointer) throws {
        for (offset, value) in values.enumerated() {
            let index = Int32(offset + 1)
            let status: Int32
            switch value {
            case .text(let string):
                let transientDestructor = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
                status = string.withCString {
                    sqlite3_bind_text(statement, index, $0, -1, transientDestructor)
                }
            case .integer(let integer):
                status = sqlite3_bind_int64(statement, index, integer)
            case .null:
                status = sqlite3_bind_null(statement, index)
            }
            guard status == SQLITE_OK else {
                throw makeError(status)
            }
        }
    }

    private func executeOnQueue(_ sql: String) throws {
        guard let connection else {
            throw SQLiteDatabaseError.connectionClosed
        }
        var errorMessage: UnsafeMutablePointer<CChar>?
        let status = sqlite3_exec(connection, sql, nil, nil, &errorMessage)
        guard status == SQLITE_OK else {
            let message =
                errorMessage.map { String(cString: $0) }
                ?? String(cString: sqlite3_errmsg(connection))
            sqlite3_free(errorMessage)
            throw SQLiteDatabaseError.queryFailed(message)
        }
    }

    private func makeError(_ status: Int32) -> SQLiteDatabaseError {
        let message =
            connection.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown SQLite error"
        return .queryFailed("SQLite status \(status): \(message)")
    }
}

enum SQLiteDatabaseError: LocalizedError {
    case openFailed(String)
    case queryFailed(String)
    case connectionClosed

    var errorDescription: String? {
        switch self {
        case .openFailed:
            "The local database couldn't be opened."
        case .queryFailed:
            "A local database operation failed."
        case .connectionClosed:
            "The local database connection is closed."
        }
    }
}
