import { initializeDatabase } from '../db';
import { isTrainingPresetId } from '../../features/training/presets';
import { type TrainingSession } from '../../features/training/trainingTypes';
import { normalizePageSize, type Page } from '../pagination';
import { trainingSessionPageSql } from './pageQueries';

type TrainingSessionRow = {
  completed_repetitions: number;
  discomfort_reported: number;
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

export async function insertTrainingSession(session: TrainingSession): Promise<void> {
  const db = await initializeDatabase();

  await db.runAsync(
    `
      INSERT OR REPLACE INTO training_sessions (
        id,
        preset_id,
        started_at,
        ended_at,
        duration_seconds,
        completed_repetitions,
        is_completed,
        discomfort_reported
      ) VALUES (
        $id,
        $presetId,
        $startedAt,
        $endedAt,
        $durationSeconds,
        $completedRepetitions,
        $isCompleted,
        $discomfortReported
      );
    `,
    {
      $completedRepetitions: session.completedRepetitions,
      $discomfortReported: session.discomfortReported ? 1 : 0,
      $durationSeconds: session.durationSeconds,
      $endedAt: session.endedAt,
      $id: session.id,
      $isCompleted: session.isCompleted ? 1 : 0,
      $presetId: session.presetId,
      $startedAt: session.startedAt,
    },
  );
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
    discomfortReported: Boolean(row.discomfort_reported),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    id: row.id,
    isCompleted: Boolean(row.is_completed),
    presetId: row.preset_id,
    startedAt: row.started_at,
  };
}
