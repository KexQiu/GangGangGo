import { initializeDatabase } from './db';
import { enqueueUnsyncedProfileData } from './profileDataBootstrap';
import { mergeAnonymousProfile } from './profileDataMerge';

export const defaultLocalProfileId = 'local-default';

export async function getActiveLocalProfileId() {
  const db = await initializeDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'active_profile_id';",
  );
  return row?.value ?? defaultLocalProfileId;
}

export async function bindActiveLocalProfileToUser(userId: string) {
  const db = await initializeDatabase();
  let profileId = defaultLocalProfileId;
  await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<{ id: string; user_id: string | null }>(
      `
        SELECT profile.id, profile.user_id
        FROM local_data_profiles profile
        INNER JOIN app_metadata metadata ON metadata.value = profile.id
        WHERE metadata.key = 'active_profile_id';
      `,
    );
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM local_data_profiles WHERE user_id = $userId;',
      { $userId: userId },
    );

    if (existing && active && active.user_id === null && active.id !== existing.id) {
      profileId = existing.id;
      await mergeAnonymousProfile(db, active.id, profileId);
    } else if (existing) {
      profileId = existing.id;
    } else if (active && active.user_id === null) {
      profileId = active.id;
      await db.runAsync('UPDATE local_data_profiles SET user_id = $userId, updated_at = $now WHERE id = $id;', {
        $id: profileId,
        $now: new Date().toISOString(),
        $userId: userId,
      });
    } else {
      profileId = `profile-${userId}`;
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO local_data_profiles (id, user_id, created_at, updated_at) VALUES ($id, $userId, $now, $now);',
        { $id: profileId, $now: now, $userId: userId },
      );
    }

    await enqueueUnsyncedProfileData(db, profileId);
    await db.runAsync(
      "INSERT INTO app_metadata (key, value) VALUES ('active_profile_id', $profileId) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
      { $profileId: profileId },
    );
  });
  return profileId;
}

export async function activateAnonymousLocalProfile() {
  const db = await initializeDatabase();
  let profileId = defaultLocalProfileId;
  await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<{ id: string; user_id: string | null }>(
      `
        SELECT profile.id, profile.user_id
        FROM local_data_profiles profile
        INNER JOIN app_metadata metadata ON metadata.value = profile.id
        WHERE metadata.key = 'active_profile_id';
      `,
    );
    if (active?.user_id === null) {
      profileId = active.id;
      return;
    }

    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM local_data_profiles WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 1;',
    );
    profileId = existing?.id ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (!existing) {
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO local_data_profiles (id, user_id, created_at, updated_at) VALUES ($id, NULL, $now, $now);',
        { $id: profileId, $now: now },
      );
    }
    await db.runAsync(
      "INSERT INTO app_metadata (key, value) VALUES ('active_profile_id', $profileId) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
      { $profileId: profileId },
    );
  });
  return profileId;
}

export async function getActiveProfileUserId() {
  const db = await initializeDatabase();
  const row = await db.getFirstAsync<{ user_id: string | null }>(
    `
      SELECT profile.user_id
      FROM local_data_profiles profile
      INNER JOIN app_metadata metadata ON metadata.value = profile.id
      WHERE metadata.key = 'active_profile_id';
    `,
  );
  return row?.user_id ?? null;
}
