import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

const DATABASE_NAME = 'xiaotidu.db';

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
  return db;
}
