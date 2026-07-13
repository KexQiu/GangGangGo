import { describe, expect, it } from 'vitest';

import { getLocalDateKey } from '../../habits/habitLogic';
import type { HabitCheckIn } from '../../habits/habitTypes';
import type { ToiletSession } from '../../toilet/toiletTypes';
import type { TrainingSession } from '../../training/trainingTypes';
import { buildRecentReportSnapshots, buildTodayReportSnapshot } from '../reportSnapshotBuilder';

describe('report snapshot builder', () => {
  it('builds a fixed 90-day series in one aggregation pass', () => {
    const now = new Date(2026, 6, 13, 10, 30, 0);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayKey = getLocalDateKey(now);
    const yesterdayKey = getLocalDateKey(yesterday);
    const habitCheckIns = [completeHabit(yesterdayKey), completeHabit(todayKey)];
    const toiletSessions = [toiletSession('toilet-today', now, 15 * 60)];
    const trainingSessions = [
      trainingSession('training-1', now, true),
      trainingSession('training-2', now, true),
      trainingSession('training-incomplete', now, false),
    ];

    const snapshots = buildRecentReportSnapshots({ habitCheckIns, toiletSessions, trainingSessions }, now);

    expect(snapshots).toHaveLength(90);
    expect(snapshots.at(-1)).toEqual({
      date: todayKey,
      habitCompletion: 4,
      streakDays: 2,
      toiletLongMeeting: true,
      toiletRecorded: true,
      trainingDone: true,
    });
    expect(habitCheckIns.map((checkIn) => checkIn.date)).toEqual([yesterdayKey, todayKey]);
  });

  it('returns an empty current-day snapshot when there are no records', () => {
    const now = new Date(2026, 6, 13, 10, 30, 0);

    expect(buildTodayReportSnapshot({ habitCheckIns: [], toiletSessions: [], trainingSessions: [] }, now)).toEqual({
      date: getLocalDateKey(now),
      habitCompletion: 0,
      streakDays: 0,
      toiletLongMeeting: false,
      toiletRecorded: false,
      trainingDone: false,
    });
  });
});

function completeHabit(date: string): HabitCheckIn {
  return {
    bowel: 'good',
    date,
    fiber: 'good',
    movement: 'good',
    updatedAt: `${date}T12:00:00.000Z`,
    water: 'good',
  };
}

function toiletSession(id: string, endedAt: Date, durationSeconds: number): ToiletSession {
  return {
    bleeding: false,
    discomfort: false,
    durationSeconds,
    endedAt: endedAt.toISOString(),
    feeling: 'normal',
    id,
    startedAt: new Date(endedAt.getTime() - durationSeconds * 1_000).toISOString(),
  };
}

function trainingSession(id: string, endedAt: Date, isCompleted: boolean): TrainingSession {
  return {
    completedRepetitions: isCompleted ? 10 : 2,
    discomfortReported: false,
    durationSeconds: 120,
    endedAt: endedAt.toISOString(),
    id,
    isCompleted,
    presetId: 'standard',
    startedAt: new Date(endedAt.getTime() - 120_000).toISOString(),
  };
}
