import * as SQLite from 'expo-sqlite';

import storageProtectionModule from '../../modules/storage-protection';
import { runMigrations } from './migrations';

// Fresh pre-release baseline; the previous development database is left untouched.
const DATABASE_NAME = 'xiaotidu-v1.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase();
  migrationPromise ??= runMigrations(db);
  await migrationPromise;
  if (storageProtectionModule && SQLite.defaultDatabaseDirectory) {
    await storageProtectionModule.protectSQLiteFiles(SQLite.defaultDatabaseDirectory, DATABASE_NAME);
  }
  return db;
}
