import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export class DatabaseService {
  readonly database: Database.Database

  constructor(userDataPath: string) {
    const filePath = join(userDataPath, 'dayplan.sqlite3')
    mkdirSync(dirname(filePath), { recursive: true })
    this.database = new Database(filePath)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('foreign_keys = ON')
    this.database.pragma('busy_timeout = 5000')
  }

  close(): void {
    this.database.close()
  }
}
