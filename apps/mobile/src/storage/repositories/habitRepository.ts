import { isHabitLevel } from '../../features/habits/habitLogic';
import { type HabitCheckIn } from '../../features/habits/habitTypes';
import { rebuildDailySummary } from '../../features/data/dailyData';
import { enqueueDataMutation } from '../dataSyncOutbox';
import { getActiveLocalProfileId } from '../localDataProfile';
import { initializeDatabase } from '../db';
import { normalizePageSize, type Page } from '../pagination';
import { habitCheckInPageSql } from './pageQueries';

type HabitCheckInRow = {
  bowel: string | null;
  date: string;
  fiber: string | null;
  movement: string | null;
  updated_at: string;
  water: string | null;
};

export type HabitCheckInPageOptions = {
  cursor?: string;
  fromDate?: string;
  limit?: number;
  toDateExclusive?: string;
};

export async function upsertHabitCheckIn(checkIn: HabitCheckIn): Promise<void> {
  const db = await initializeDatabase();
  const profileId = await getActiveLocalProfileId();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      INSERT INTO habit_checkins (
        profile_id,
        date,
        water,
        fiber,
        movement,
        bowel,
        updated_at
      ) VALUES (
        $profileId,
        $date,
        $water,
        $fiber,
        $movement,
        $bowel,
        $updatedAt
      )
      ON CONFLICT(profile_id, date) DO UPDATE SET
        water = excluded.water,
        fiber = excluded.fiber,
        movement = excluded.movement,
        bowel = excluded.bowel,
        updated_at = excluded.updated_at;
    `,
      {
        $bowel: checkIn.bowel,
        $date: checkIn.date,
        $fiber: checkIn.fiber,
        $movement: checkIn.movement,
        $profileId: profileId,
        $updatedAt: checkIn.updatedAt,
        $water: checkIn.water,
      },
    );
    await enqueueDataMutation(
      {
        entityId: checkIn.date,
        entityType: 'habit_checkin',
        operation: 'upsert',
        payload: {
          bowel: checkIn.bowel,
          date: checkIn.date,
          fiber: checkIn.fiber,
          movement: checkIn.movement,
          water: checkIn.water,
        },
      },
      db,
      profileId,
    );
  });
  await rebuildDailySummary(checkIn.date);
}

export async function listHabitCheckInsPage(
  options: HabitCheckInPageOptions = {},
): Promise<Page<HabitCheckIn, string>> {
  const db = await initializeDatabase();
  const limit = normalizePageSize(options.limit);
  const rows = await db.getAllAsync<HabitCheckInRow>(habitCheckInPageSql, {
    $cursorDate: options.cursor ?? null,
    $fromDate: options.fromDate ?? null,
    $queryLimit: limit + 1,
    $toDateExclusive: options.toDateExclusive ?? null,
  });
  const pageRows = rows.slice(0, limit);

  return {
    items: pageRows.map(rowToHabitCheckIn),
    nextCursor: rows.length > limit ? (pageRows.at(-1)?.date ?? null) : null,
  };
}

function rowToHabitCheckIn(row: HabitCheckInRow): HabitCheckIn {
  return {
    bowel: isHabitLevel(row.bowel) ? row.bowel : null,
    date: row.date,
    fiber: isHabitLevel(row.fiber) ? row.fiber : null,
    movement: isHabitLevel(row.movement) ? row.movement : null,
    updatedAt: row.updated_at,
    water: isHabitLevel(row.water) ? row.water : null,
  };
}
