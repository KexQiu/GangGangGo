import { commitLocalMutation, PermanentMutationError, type LocalMutationOptions } from '../localMutation';
import { initializeDatabase } from '../db';
import { isTrainingPresetId } from '../../features/training/presets';
import { type TrainingSession } from '../../features/training/trainingTypes';
import { getLocalDateKey } from '../../features/habits/habitLogic';
import { rebuildDailySummary } from '../../features/data/dailyData';
import { enqueueDataMutation } from '../dataSyncOutbox';
import { normalizePageSize, type Page } from '../pagination';
import { trainingSessionPageSql } from './pageQueries';

type TrainingSessionRow = {
  completed_repetitions: number;
  feedback: TrainingSession['feedback'];
  end_reason: TrainingSession['endReason'];
  plan_json: string;
  duration_seconds: number;
  ended_at: string;
  id: string;
  is_completed: number;
  preset_id: string;
  started_at: string;
};

export type TrainingSessionCursor = {
  endedAt: string;
  id: string;
};

export type TrainingSessionPageOptions = {
  cursor?: TrainingSessionCursor;
  fromDateTime?: string;
  limit?: number;
  toDateTimeExclusive?: string;
};

export async function insertTrainingSession(session: TrainingSession, options: LocalMutationOptions = {}) {
  const localDate = getLocalDateKey(new Date(session.endedAt));
  const updatedAt = new Date().toISOString();

  return commitLocalMutation(options, async (db, profileId) => {
    // 保存成功后、清理计时快照前退出进程，重启重试仍使用原 ID，不重复累计或上传。
    const existing = await db.getFirstAsync<TrainingSessionRow & { profile_id: string }>(
      'SELECT * FROM training_sessions WHERE id = $id;',
      { $id: session.id },
    );
    if (existing) {
      if (existing.profile_id !== profileId) throw new PermanentMutationError('训练记录不属于当前账号。');
      const previous = rowToTrainingSession(existing);
      if (
        !previous ||
        (Object.keys(session) as Array<keyof TrainingSession>).some((key) =>
          key === 'plan'
            ? session.plan.contractSeconds !== previous.plan.contractSeconds ||
              session.plan.relaxSeconds !== previous.plan.relaxSeconds ||
              session.plan.repetitions !== previous.plan.repetitions
            : session[key] !== previous[key],
        )
      ) {
        throw new PermanentMutationError('训练记录编号相同但内容不同，请重新打开训练。');
      }
      return;
    }
    await db.runAsync(
      `
      INSERT INTO training_sessions (
        id,
        preset_id,
        started_at,
        ended_at,
        duration_seconds,
        completed_repetitions,
        is_completed,
        feedback, end_reason, plan_json,
        profile_id,
        local_date,
        updated_at
      ) VALUES (
        $id,
        $presetId,
        $startedAt,
        $endedAt,
        $durationSeconds,
        $completedRepetitions,
        $isCompleted,
        $feedback, $endReason, $planJson,
        $profileId,
        $localDate,
        $updatedAt
      );
    `,
      {
        $completedRepetitions: session.completedRepetitions,
        $feedback: session.feedback,
        $endReason: session.endReason,
        $planJson: JSON.stringify(session.plan),
        $durationSeconds: session.durationSeconds,
        $endedAt: session.endedAt,
        $id: session.id,
        $isCompleted: session.isCompleted ? 1 : 0,
        $localDate: localDate,
        $presetId: session.presetId,
        $profileId: profileId,
        $startedAt: session.startedAt,
        $updatedAt: updatedAt,
      },
    );
    await enqueueDataMutation(
      {
        entityId: session.id,
        entityType: 'training_session',
        operation: 'upsert',
        payload: {
          completedRepetitions: session.completedRepetitions,
          feedback: session.feedback,
          endReason: session.endReason,
          plan: session.plan,
          durationSeconds: session.durationSeconds,
          endedAt: session.endedAt,
          isCompleted: session.isCompleted,
          localDate,
          presetId: session.presetId,
          startedAt: session.startedAt,
        },
      },
      db,
      profileId,
    );
    await rebuildDailySummary(localDate, db, profileId);
  });
}

export async function listTrainingSessionsPage(
  options: TrainingSessionPageOptions = {},
): Promise<Page<TrainingSession, TrainingSessionCursor>> {
  const db = await initializeDatabase();
  const limit = normalizePageSize(options.limit);
  const rows = await db.getAllAsync<TrainingSessionRow>(trainingSessionPageSql, {
    $cursorEndedAt: options.cursor?.endedAt ?? null,
    $cursorId: options.cursor?.id ?? null,
    $fromDateTime: options.fromDateTime ?? null,
    $queryLimit: limit + 1,
    $toDateTimeExclusive: options.toDateTimeExclusive ?? null,
  });
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1);

  return {
    items: pageRows.map(rowToTrainingSession).filter((session): session is TrainingSession => Boolean(session)),
    nextCursor:
      rows.length > limit && lastRow
        ? {
            endedAt: lastRow.ended_at,
            id: lastRow.id,
          }
        : null,
  };
}

function rowToTrainingSession(row: TrainingSessionRow): TrainingSession | null {
  if (!isTrainingPresetId(row.preset_id)) {
    return null;
  }

  return {
    completedRepetitions: row.completed_repetitions,
    feedback: row.feedback,
    endReason: row.end_reason,
    plan: JSON.parse(row.plan_json),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    id: row.id,
    isCompleted: Boolean(row.is_completed),
    presetId: row.preset_id,
    startedAt: row.started_at,
  };
}

export async function getTrainingSession(id: string): Promise<TrainingSession | null> {
  const db = await initializeDatabase();
  const row = await db.getFirstAsync<TrainingSessionRow>(
    `SELECT * FROM training_sessions WHERE id = $id
    AND profile_id = (SELECT value FROM app_metadata WHERE key = 'active_profile_id') AND deleted_at IS NULL;`,
    { $id: id },
  );
  return row ? rowToTrainingSession(row) : null;
}
