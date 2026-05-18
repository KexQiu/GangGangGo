import { isHabitLevel } from '../../features/habits/habitLogic';
import { type HabitCheckIn } from '../../features/habits/habitTypes';
import { initializeDatabase } from '../db';

type HabitCheckInRow = {
  bowel: string | null;
  date: string;
  fiber: string | null;
  movement: string | null;
  updated_at: string;
  water: string | null;
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

export async function listHabitCheckIns(): Promise<HabitCheckIn[]> {
  const db = await initializeDatabase();
  const rows = await db.getAllAsync<HabitCheckInRow>(
    `
      SELECT
        date,
        water,
        fiber,
        movement,
        bowel,
        updated_at
      FROM habit_checkins
      ORDER BY date DESC;
    `,
  );

  return rows.map(rowToHabitCheckIn);
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
