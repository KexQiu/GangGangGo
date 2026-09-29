import {
  createDefaultTrainingPreferences,
  trainingPreferencesSchema,
  type TrainingPreferences,
} from '@xiaotidu/contracts';
import { create } from 'zustand';
import { authSessionContext } from '../../api/sessionContext';
import { initializeDatabase } from '../../storage/db';
import { getActiveLocalProfileId } from '../../storage/localDataProfile';
import { commitLocalMutation } from '../../storage/localMutation';
import { enqueueDataMutation } from '../../storage/dataSyncOutbox';
import { notifyLocalDataChanged } from '../sync/localDataEvents';

type State = {
  preferences: TrainingPreferences;
  hasHydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  reset: () => void;
  update: (patch: Partial<TrainingPreferences>) => Promise<void>;
};
let revision = 0;
export const useTrainingPreferencesStore = create<State>((set) => ({
  preferences: createDefaultTrainingPreferences(),
  hasHydrated: false,
  error: null,
  reset: () => {
    revision += 1;
    set({ preferences: createDefaultTrainingPreferences(), hasHydrated: false, error: null });
  },
  hydrate: async () => {
    const request = ++revision;
    const generation = authSessionContext.getGeneration();
    try {
      const db = await initializeDatabase();
      const profileId = await getActiveLocalProfileId();
      const row = await db.getFirstAsync<{ value_json: string }>(
        'SELECT value_json FROM training_preferences WHERE profile_id = $profileId;',
        { $profileId: profileId },
      );
      if (request !== revision || !authSessionContext.isGenerationCurrent(generation)) return;
      set({
        preferences: row
          ? trainingPreferencesSchema.parse(JSON.parse(row.value_json))
          : createDefaultTrainingPreferences(),
        hasHydrated: true,
        error: null,
      });
    } catch (error) {
      if (request === revision && authSessionContext.isGenerationCurrent(generation))
        set({ error: error instanceof Error ? error.message : '训练设置读取失败', hasHydrated: false });
    }
  },
  update: async (patch) => {
    const generation = authSessionContext.captureLocalGeneration();
    await commitLocalMutation({ generation }, async (db, profileId) => {
      const row = await db.getFirstAsync<{ value_json: string }>(
        'SELECT value_json FROM training_preferences WHERE profile_id = $profileId;',
        { $profileId: profileId },
      );
      const value = trainingPreferencesSchema.parse({
        ...(row ? JSON.parse(row.value_json) : createDefaultTrainingPreferences()),
        ...patch,
      });
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO training_preferences (profile_id, value_json, updated_at, sync_version)
        VALUES ($profileId, $value, $now, 0) ON CONFLICT(profile_id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at;`,
        { $profileId: profileId, $value: JSON.stringify(value), $now: now },
      );
      await enqueueDataMutation(
        { entityType: 'training_preferences', entityId: 'preferences', operation: 'upsert', payload: value },
        db,
        profileId,
      );
    });
    if (authSessionContext.isGenerationCurrent(generation)) {
      await useTrainingPreferencesStore.getState().hydrate();
      notifyLocalDataChanged();
    }
  },
}));
