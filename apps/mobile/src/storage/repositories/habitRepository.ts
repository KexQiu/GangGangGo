import { isHabitLevel } from '../../features/habits/habitLogic';
import { type HabitCheckIn } from '../../features/habits/habitTypes';
import { initializeDatabase } from '../db';
import { normalizePageSize, type Page } from '../pagination';

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

  await db.runAsync(
    `
      INSERT INTO habit_checkins (
        date,
        water,
        fiber,
        movement,
        bowel,
        updated_at
      ) VALUES (
        $date,
        $water,
        $fiber,
        $movement,
        $bowel,
        $updatedAt
      )
      ON CONFLICT(date) DO UPDATE SET
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
      $updatedAt: checkIn.updatedAt,
      $water: checkIn.water,
    },
  );
}

export async function listHabitCheckInsPage(
  options: HabitCheckInPageOptions = {},
): Promise<Page<HabitCheckIn, string>> {
  const db = await initializeDatabase();
  const limit = normalizePageSize(options.limit);
  const query = `
      SELECT
        date,
        water,
        fiber,
        movement,
        bowel,
        updated_at
      FROM habit_checkins
      WHERE ($fromDate IS NULL OR date >= $fromDate)
        AND ($toDateExclusive IS NULL OR date < $toDateExclusive)
        AND ($cursorDate IS NULL OR date < $cursorDate)
      ORDER BY date DESC
      LIMIT $queryLimit;
    `;
  const rows = await db.getAllAsync<HabitCheckInRow>(query, {
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
