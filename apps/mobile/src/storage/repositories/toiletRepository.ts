import { type ToiletFeeling, type ToiletSession } from '../../features/toilet/toiletTypes';
import { initializeDatabase } from '../db';

type ToiletSessionRow = {
  bleeding: number;
  discomfort: number;
  duration_seconds: number;
  ended_at: string;
  feeling: string;
  id: string;
  started_at: string;
};

const toiletFeelings = new Set<ToiletFeeling>(['smooth', 'normal', 'difficult']);

export async function insertToiletSession(session: ToiletSession): Promise<void> {
  const db = await initializeDatabase();

  await db.runAsync(
    `
      INSERT OR REPLACE INTO toilet_sessions (
        id,
        started_at,
        ended_at,
        duration_seconds,
        feeling,
        discomfort,
        bleeding
      ) VALUES (
        $id,
        $startedAt,
        $endedAt,
        $durationSeconds,
        $feeling,
        $discomfort,
        $bleeding
      );
    `,
    {
      $bleeding: session.bleeding ? 1 : 0,
      $discomfort: session.discomfort ? 1 : 0,
      $durationSeconds: session.durationSeconds,
      $endedAt: session.endedAt,
      $feeling: session.feeling,
      $id: session.id,
      $startedAt: session.startedAt,
    },
  );
}

export async function listToiletSessions(): Promise<ToiletSession[]> {
  const db = await initializeDatabase();
  const rows = await db.getAllAsync<ToiletSessionRow>(
    `
      SELECT
        id,
        started_at,
        ended_at,
        duration_seconds,
        feeling,
        discomfort,
        bleeding
      FROM toilet_sessions
      ORDER BY ended_at DESC;
    `,
  );

  return rows.map(rowToToiletSession).filter((session): session is ToiletSession => Boolean(session));
}

function rowToToiletSession(row: ToiletSessionRow): ToiletSession | null {
  if (!toiletFeelings.has(row.feeling as ToiletFeeling)) {
    return null;
  }

  return {
    bleeding: Boolean(row.bleeding),
    discomfort: Boolean(row.discomfort),
    durationSeconds: row.duration_seconds,
    endedAt: row.ended_at,
    feeling: row.feeling as ToiletFeeling,
    id: row.id,
    startedAt: row.started_at,
  };
}
