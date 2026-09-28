import { authSessionContext, SessionChangedError } from '../api/sessionContext';
import { initializeDatabase } from './db';
import { getActiveLocalProfileId } from './localDataProfile';

export class PermanentMutationError extends Error {}

export type LocalMutationOptions = {
  generation?: number;
  profileId?: string;
  assertCurrent?: () => void;
  assertMutationTarget?: () => void;
  receipt?: { eventId: string; eventJson: string };
};
export type LocalMutationResult<T = void> = { status: 'saved'; value: T } | { status: 'duplicate' };

/** 资料切换、写入、outbox、汇总和 Watch 回执共用一个提交边界。 */
export async function commitLocalMutation<T>(
  options: LocalMutationOptions,
  mutation: (db: Awaited<ReturnType<typeof initializeDatabase>>, profileId: string) => Promise<T>,
): Promise<LocalMutationResult<T>> {
  const generation = options.generation ?? authSessionContext.captureLocalGeneration();
  return authSessionContext.runExclusive(generation, async () => {
    const db = await initializeDatabase();
    const profileId = await getActiveLocalProfileId();
    const assertCurrent = () => {
      authSessionContext.assertGeneration(generation);
      if (options.profileId && options.profileId !== profileId) throw new SessionChangedError();
      options.assertCurrent?.();
    };
    assertCurrent();
    let result: LocalMutationResult<T> = { status: 'duplicate' };
    await db.withTransactionAsync(async () => {
      const receipt = options.receipt;
      if (receipt) {
        const previous = await db.getFirstAsync<{ event_json: string }>(
          'SELECT event_json FROM watch_event_receipts WHERE profile_id = $profileId AND event_id = $eventId;',
          { $profileId: profileId, $eventId: receipt.eventId },
        );
        if (previous) {
          if (previous.event_json !== receipt.eventJson)
            throw new PermanentMutationError('手表事件编号重复但内容不同。');
          assertCurrent();
          return;
        }
      }
      options.assertMutationTarget?.();
      const value = await mutation(db, profileId);
      if (receipt) {
        await db.runAsync(
          'INSERT INTO watch_event_receipts (profile_id, event_id, event_json, processed_at) VALUES ($profileId, $eventId, $eventJson, $now);',
          {
            $profileId: profileId,
            $eventId: receipt.eventId,
            $eventJson: receipt.eventJson,
            $now: new Date().toISOString(),
          },
        );
        // 事件最多重放 24 小时，回执保留 48 小时覆盖 ACK 丢失与重启。
        await db.runAsync('DELETE FROM watch_event_receipts WHERE processed_at < $cutoff;', {
          $cutoff: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        });
      }
      assertCurrent();
      options.assertMutationTarget?.();
      result = { status: 'saved', value };
    });
    return result;
  });
}

export async function hasWatchReceipt(options: LocalMutationOptions) {
  if (!options.receipt || options.generation === undefined || !options.profileId) return false;
  return authSessionContext.runExclusive(options.generation, async () => {
    const db = await initializeDatabase();
    const row = await db.getFirstAsync<{ event_json: string }>(
      'SELECT event_json FROM watch_event_receipts WHERE profile_id = $profileId AND event_id = $eventId;',
      { $profileId: options.profileId!, $eventId: options.receipt!.eventId },
    );
    options.assertCurrent?.();
    if (!row) return false;
    if (row.event_json !== options.receipt!.eventJson) throw new PermanentMutationError('手表事件编号重复但内容不同。');
    return true;
  });
}
