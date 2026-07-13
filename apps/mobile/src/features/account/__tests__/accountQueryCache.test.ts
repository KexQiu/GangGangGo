import { DatabaseSync } from 'node:sqlite';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import type { UserProfile } from '@xiaotidu/contracts';

import { queryKeys } from '../../../api/queryKeys';
import { clearCloudQueryCache, resetCloudQueryCacheForUser } from '../accountQueryCache';

const databases: DatabaseSync[] = [];
const oldUser = createUser('00000000-0000-4000-8000-000000000001', '旧用户');
const newUser = createUser('00000000-0000-4000-8000-000000000002', '新用户');

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('account query cache', () => {
  it('clears cloud data and seeds the new mock user without changing SQLite health records', () => {
    const queryClient = createPopulatedQueryClient();
    const database = createHealthDatabase();

    resetCloudQueryCacheForUser(queryClient, newUser);

    expect(queryClient.getQueryData(queryKeys.currentUser)).toEqual(newUser);
    expect(queryClient.getQueryData(queryKeys.entitlements)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.team(oldUser.id))).toBeUndefined();
    expect(getHealthRecordIds(database)).toEqual(['health-record-1']);
  });

  it('clears session cloud data without changing SQLite health records', () => {
    const queryClient = createPopulatedQueryClient();
    const database = createHealthDatabase();

    clearCloudQueryCache(queryClient);

    expect(queryClient.getQueryData(queryKeys.currentUser)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.entitlements)).toBeUndefined();
    expect(getHealthRecordIds(database)).toEqual(['health-record-1']);
  });
});

function createPopulatedQueryClient() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.currentUser, oldUser);
  queryClient.setQueryData(queryKeys.entitlements, { proStatus: 'pro_active' });
  queryClient.setQueryData(queryKeys.team(oldUser.id), { team: null });
  return queryClient;
}

function createHealthDatabase() {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(`
    CREATE TABLE health_records (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    INSERT INTO health_records (id, value) VALUES ('health-record-1', 'local-only');
  `);
  return database;
}

function getHealthRecordIds(database: DatabaseSync): string[] {
  return database
    .prepare('SELECT id FROM health_records ORDER BY id')
    .all()
    .map((row) => String(row.id));
}

function createUser(id: string, nickname: string): UserProfile {
  return { avatarUrl: null, id, nickname, timezone: 'Asia/Shanghai' };
}
