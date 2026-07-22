import type { DailyActivitySummary } from '@xiaotidu/contracts';

import { initializeDatabase } from '../../storage/db';
import { buildLocalDateRange } from '../../storage/dateRange';
import { getActiveLocalProfileId } from '../../storage/localDataProfile';
import type { HabitLevel } from '../habits/habitTypes';
import type { ToiletSession } from '../toilet/toiletTypes';
import type { TrainingSession } from '../training/trainingTypes';

type CountMap = Record<string, number>;

export type DailyDataDetails = {
  summary: DailyActivitySummary;
  toiletSessions: ToiletSession[];
  trainingSessions: TrainingSession[];
};

export async function rebuildRecentDailySummaries(days = 90, now = new Date()) {
  const range = buildLocalDateRange(days, now);
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    return formatLocalDate(date);
  });
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM daily_activity_summaries WHERE profile_id = $profileId AND date < $fromDate;', {
      $fromDate: range.fromDate,
      $profileId: profileId,
    });
    for (const date of dates) await rebuildDailySummary(date, db, profileId);
  });
}

export async function rebuildDailySummary(
  date: string,
  database?: Awaited<ReturnType<typeof initializeDatabase>>,
  providedProfileId?: string,
) {
  const db = database ?? (await initializeDatabase());
  const profileId = providedProfileId ?? (await getActiveLocalProfileId());
  const [trainingRows, habit, toiletRows] = await Promise.all([
    db.getAllAsync<TrainingRow>(
      `SELECT * FROM training_sessions WHERE profile_id = $profileId AND local_date = $date AND deleted_at IS NULL;`,
      { $date: date, $profileId: profileId },
    ),
    db.getFirstAsync<HabitRow>(
      `SELECT * FROM habit_checkins WHERE profile_id = $profileId AND date = $date AND deleted_at IS NULL;`,
      { $date: date, $profileId: profileId },
    ),
    db.getAllAsync<ToiletRow>(
      `SELECT * FROM toilet_sessions WHERE profile_id = $profileId AND local_date = $date AND deleted_at IS NULL;`,
      { $date: date, $profileId: profileId },
    ),
  ]);
  const summary = buildSummary(date, trainingRows, habit, toiletRows);
  await db.runAsync(
    `
      INSERT INTO daily_activity_summaries (
        profile_id, date,
        training_completed_count, training_total_duration_seconds, training_completed_repetitions,
        habit_water, habit_fiber, habit_movement, habit_bowel, habit_completion_count,
        toilet_session_count, toilet_total_duration_seconds, toilet_median_duration_seconds, toilet_max_duration_seconds,
        toilet_long_session_count, toilet_attention_count, toilet_feeling_counts_json,
        toilet_shape_counts_json, toilet_color_counts_json, toilet_signal_counts_json, computed_at
      ) VALUES (
        $profileId, $date,
        $trainingCompletedCount, $trainingTotalDurationSeconds, $trainingCompletedRepetitions,
        $habitWater, $habitFiber, $habitMovement, $habitBowel, $habitCompletionCount,
        $toiletSessionCount, $toiletTotalDurationSeconds, $toiletMedianDurationSeconds, $toiletMaxDurationSeconds,
        $toiletLongSessionCount, $toiletAttentionCount, $toiletFeelingCountsJson,
        $toiletShapeCountsJson, $toiletColorCountsJson, $toiletSignalCountsJson, $computedAt
      )
      ON CONFLICT(profile_id, date) DO UPDATE SET
        training_completed_count = excluded.training_completed_count,
        training_total_duration_seconds = excluded.training_total_duration_seconds,
        training_completed_repetitions = excluded.training_completed_repetitions,
        habit_water = excluded.habit_water,
        habit_fiber = excluded.habit_fiber,
        habit_movement = excluded.habit_movement,
        habit_bowel = excluded.habit_bowel,
        habit_completion_count = excluded.habit_completion_count,
        toilet_session_count = excluded.toilet_session_count,
        toilet_total_duration_seconds = excluded.toilet_total_duration_seconds,
        toilet_median_duration_seconds = excluded.toilet_median_duration_seconds,
        toilet_max_duration_seconds = excluded.toilet_max_duration_seconds,
        toilet_long_session_count = excluded.toilet_long_session_count,
        toilet_attention_count = excluded.toilet_attention_count,
        toilet_feeling_counts_json = excluded.toilet_feeling_counts_json,
        toilet_shape_counts_json = excluded.toilet_shape_counts_json,
        toilet_color_counts_json = excluded.toilet_color_counts_json,
        toilet_signal_counts_json = excluded.toilet_signal_counts_json,
        computed_at = excluded.computed_at;
    `,
    summaryParameters(profileId, summary),
  );
  return summary;
}

export async function listDailyActivitySummaries(days = 90, now = new Date()) {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const range = buildLocalDateRange(days, now);
  const rows = await db.getAllAsync<DailySummaryRow>(
    `
      SELECT * FROM daily_activity_summaries
      WHERE profile_id = $profileId AND date >= $fromDate AND date < $toDate
      ORDER BY date ASC;
    `,
    { $fromDate: range.fromDate, $profileId: profileId, $toDate: range.toDateExclusive },
  );
  const summaries = new Map(rows.map((row) => [row.date, rowToSummary(row)]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const dateKey = formatLocalDate(date);
    return summaries.get(dateKey) ?? emptyDailySummary(dateKey);
  });
}

export async function getDailyDataDetails(date: string): Promise<DailyDataDetails> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const summary = await rebuildDailySummary(date, db, profileId);
  const [trainingRows, toiletRows] = await Promise.all([
    db.getAllAsync<TrainingRow>(
      `SELECT * FROM training_sessions WHERE profile_id = $profileId AND local_date = $date AND deleted_at IS NULL ORDER BY ended_at DESC;`,
      { $date: date, $profileId: profileId },
    ),
    db.getAllAsync<ToiletRow>(
      `SELECT * FROM toilet_sessions WHERE profile_id = $profileId AND local_date = $date AND deleted_at IS NULL ORDER BY ended_at DESC;`,
      { $date: date, $profileId: profileId },
    ),
  ]);
  return {
    summary,
    toiletSessions: toiletRows.map(rowToToiletSession),
    trainingSessions: trainingRows.map(rowToTrainingSession),
  };
}

export async function purgeExpiredLocalHealthData(now = new Date()) {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();
  const range = buildLocalDateRange(90, now);
  await db.withTransactionAsync(async () => {
    await Promise.all([
      db.runAsync('DELETE FROM training_sessions WHERE profile_id = $profileId AND local_date < $cutoff;', {
        $cutoff: range.fromDate,
        $profileId: profileId,
      }),
      db.runAsync('DELETE FROM habit_checkins WHERE profile_id = $profileId AND date < $cutoff;', {
        $cutoff: range.fromDate,
        $profileId: profileId,
      }),
      db.runAsync('DELETE FROM toilet_sessions WHERE profile_id = $profileId AND local_date < $cutoff;', {
        $cutoff: range.fromDate,
        $profileId: profileId,
      }),
      db.runAsync('DELETE FROM daily_activity_summaries WHERE profile_id = $profileId AND date < $cutoff;', {
        $cutoff: range.fromDate,
        $profileId: profileId,
      }),
      db.runAsync(
        `DELETE FROM toilet_signal_presets
         WHERE profile_id = $profileId AND deleted_at IS NOT NULL AND substr(deleted_at, 1, 10) < $cutoff;`,
        { $cutoff: range.fromDate, $profileId: profileId },
      ),
      db.runAsync(
        `
          DELETE FROM data_sync_outbox
          WHERE profile_id = $profileId
            AND operation = 'upsert'
            AND (
              (entity_type = 'habit_checkin' AND json_extract(payload_json, '$.date') < $cutoff)
              OR (
                entity_type IN ('training_session', 'toilet_session')
                AND json_extract(payload_json, '$.localDate') < $cutoff
              )
            );
        `,
        { $cutoff: range.fromDate, $profileId: profileId },
      ),
    ]);
  });
}

export function emptyDailySummary(date: string): DailyActivitySummary {
  return {
    date,
    habit: { bowel: null, completionCount: 0, fiber: null, movement: null, water: null },
    toilet: {
      attentionCount: 0,
      colorCounts: {},
      feelingCounts: {},
      longSessionCount: 0,
      maxDurationSeconds: 0,
      medianDurationSeconds: 0,
      sessionCount: 0,
      shapeCounts: {},
      signalCounts: {},
      totalDurationSeconds: 0,
    },
    training: { completedRepetitions: 0, completedSessionCount: 0, totalDurationSeconds: 0 },
  };
}

function buildSummary(date: string, training: TrainingRow[], habit: HabitRow | null, toilets: ToiletRow[]) {
  const durations = toilets.map((row) => row.duration_seconds).sort((left, right) => left - right);
  return {
    date,
    habit: {
      bowel: toHabitLevel(habit?.bowel),
      completionCount: [habit?.water, habit?.fiber, habit?.movement, habit?.bowel].filter(Boolean).length,
      fiber: toHabitLevel(habit?.fiber),
      movement: toHabitLevel(habit?.movement),
      water: toHabitLevel(habit?.water),
    },
    toilet: {
      attentionCount: toilets.filter(
        (row) =>
          Boolean(row.bleeding) ||
          Boolean(row.discomfort) ||
          row.stool_color === 'attention' ||
          parseSignals(row.signals_json).length > 0,
      ).length,
      colorCounts: countValues(toilets.map((row) => row.stool_color)),
      feelingCounts: countValues(toilets.map((row) => row.feeling)),
      longSessionCount: toilets.filter((row) => row.duration_seconds >= 10 * 60).length,
      maxDurationSeconds: durations.at(-1) ?? 0,
      medianDurationSeconds: median(durations),
      sessionCount: toilets.length,
      shapeCounts: countValues(toilets.map((row) => row.stool_shape)),
      signalCounts: countValues(toilets.flatMap((row) => parseSignals(row.signals_json).map((signal) => signal.label))),
      totalDurationSeconds: durations.reduce((total, duration) => total + duration, 0),
    },
    training: {
      completedRepetitions: training.reduce((total, row) => total + row.completed_repetitions, 0),
      completedSessionCount: training.filter((row) => Boolean(row.is_completed)).length,
      totalDurationSeconds: training.reduce((total, row) => total + row.duration_seconds, 0),
    },
  } satisfies DailyActivitySummary;
}

function summaryParameters(profileId: string, summary: DailyActivitySummary) {
  return {
    $computedAt: new Date().toISOString(),
    $date: summary.date,
    $habitBowel: summary.habit.bowel,
    $habitCompletionCount: summary.habit.completionCount,
    $habitFiber: summary.habit.fiber,
    $habitMovement: summary.habit.movement,
    $habitWater: summary.habit.water,
    $profileId: profileId,
    $toiletAttentionCount: summary.toilet.attentionCount,
    $toiletColorCountsJson: JSON.stringify(summary.toilet.colorCounts),
    $toiletFeelingCountsJson: JSON.stringify(summary.toilet.feelingCounts),
    $toiletLongSessionCount: summary.toilet.longSessionCount,
    $toiletMaxDurationSeconds: summary.toilet.maxDurationSeconds,
    $toiletMedianDurationSeconds: summary.toilet.medianDurationSeconds,
    $toiletSessionCount: summary.toilet.sessionCount,
    $toiletShapeCountsJson: JSON.stringify(summary.toilet.shapeCounts),
    $toiletSignalCountsJson: JSON.stringify(summary.toilet.signalCounts),
    $toiletTotalDurationSeconds: summary.toilet.totalDurationSeconds,
    $trainingCompletedCount: summary.training.completedSessionCount,
    $trainingCompletedRepetitions: summary.training.completedRepetitions,
    $trainingTotalDurationSeconds: summary.training.totalDurationSeconds,
  };
}

type TrainingRow = {
  completed_repetitions: number;
  discomfort_reported: number;
  duration_seconds: number;
  ended_at: string;
  id: string;
  is_completed: number;
  preset_id: string;
  started_at: string;
};
type HabitRow = { bowel: string | null; fiber: string | null; movement: string | null; water: string | null };
type ToiletRow = {
  bleeding: number;
  discomfort: number;
  duration_seconds: number;
  ended_at: string;
  feeling: ToiletSession['feeling'];
  id: string;
  signals_json: string | null;
  started_at: string;
  stool_color: ToiletSession['stoolColor'];
  stool_shape: ToiletSession['stoolShape'];
};
type DailySummaryRow = {
  date: string;
  habit_bowel: string | null;
  habit_completion_count: number;
  habit_fiber: string | null;
  habit_movement: string | null;
  habit_water: string | null;
  toilet_attention_count: number;
  toilet_color_counts_json: string;
  toilet_feeling_counts_json: string;
  toilet_long_session_count: number;
  toilet_max_duration_seconds: number;
  toilet_median_duration_seconds: number;
  toilet_session_count: number;
  toilet_shape_counts_json: string;
  toilet_signal_counts_json: string;
  toilet_total_duration_seconds: number;
  training_completed_count: number;
  training_completed_repetitions: number;
  training_total_duration_seconds: number;
};

function rowToSummary(row: DailySummaryRow): DailyActivitySummary {
  return {
    date: row.date,
    habit: {
      bowel: toHabitLevel(row.habit_bowel),
      completionCount: row.habit_completion_count,
      fiber: toHabitLevel(row.habit_fiber),
      movement: toHabitLevel(row.habit_movement),
      water: toHabitLevel(row.habit_water),
    },
    toilet: {
      attentionCount: row.toilet_attention_count,
      colorCounts: parseCountMap(row.toilet_color_counts_json),
      feelingCounts: parseCountMap(row.toilet_feeling_counts_json),
      longSessionCount: row.toilet_long_session_count,
      maxDurationSeconds: row.toilet_max_duration_seconds,
      medianDurationSeconds: row.toilet_median_duration_seconds,
      sessionCount: row.toilet_session_count,
      shapeCounts: parseCountMap(row.toilet_shape_counts_json),
      signalCounts: parseCountMap(row.toilet_signal_counts_json),
      totalDurationSeconds: row.toilet_total_duration_seconds,
    },
    training: {
      completedRepetitions: row.training_completed_repetitions,
      completedSessionCount: row.training_completed_count,
      totalDurationSeconds: row.training_total_duration_seconds,
    },
  };
}

function rowToTrainingSession(row: TrainingRow): TrainingSession {
  return {
    completedRepetitions: row.completed_repetitions,
    discomfortReported: Boolean(row.discomfort_reported),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    id: row.id,
    isCompleted: Boolean(row.is_completed),
    presetId: row.preset_id as TrainingSession['presetId'],
    startedAt: row.started_at,
  };
}

function rowToToiletSession(row: ToiletRow): ToiletSession {
  return {
    bleeding: Boolean(row.bleeding),
    discomfort: Boolean(row.discomfort),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    feeling: row.feeling,
    id: row.id,
    signals: parseSignals(row.signals_json),
    startedAt: row.started_at,
    stoolColor: row.stool_color,
    stoolShape: row.stool_shape,
  };
}

function parseSignals(value: string | null): Array<{ id: string; label: string }> {
  try {
    return value ? (JSON.parse(value) as Array<{ id: string; label: string }>) : [];
  } catch {
    return [];
  }
}
function parseCountMap(value: string): CountMap {
  try {
    return JSON.parse(value) as CountMap;
  } catch {
    return {};
  }
}
function countValues(values: Array<string | null | undefined>) {
  const result: CountMap = {};
  for (const value of values) if (value) result[value] = (result[value] ?? 0) + 1;
  return result;
}
function median(values: number[]) {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2)
    : (values[middle] ?? 0);
}
function toHabitLevel(value: string | null | undefined): HabitLevel | null {
  return value === 'good' || value === 'low' || value === 'medium' ? value : null;
}
function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
