import { type ToiletFeeling, type ToiletSession } from '../../features/toilet/toiletTypes';
import { initializeDatabase } from '../db';
import { normalizePageSize, type Page } from '../pagination';

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

export type ToiletSessionCursor = {
  endedAt: string;
  id: string;
};

export type ToiletSessionPageOptions = {
  cursor?: ToiletSessionCursor;
  fromDateTime?: string;
  limit?: number;
  toDateTimeExclusive?: string;
};

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

export async function listToiletSessionsPage(
  options: ToiletSessionPageOptions = {},
): Promise<Page<ToiletSession, ToiletSessionCursor>> {
  const db = await initializeDatabase();
  const limit = normalizePageSize(options.limit);
  const query = `
      SELECT
        id,
        started_at,
        ended_at,
        duration_seconds,
        feeling,
        discomfort,
        bleeding
      FROM toilet_sessions
      WHERE ($fromDateTime IS NULL OR ended_at >= $fromDateTime)
        AND ($toDateTimeExclusive IS NULL OR ended_at < $toDateTimeExclusive)
        AND (
          $cursorEndedAt IS NULL
          OR ended_at < $cursorEndedAt
          OR (ended_at = $cursorEndedAt AND id < $cursorId)
        )
      ORDER BY ended_at DESC, id DESC
      LIMIT $queryLimit;
    `;
  const rows = await db.getAllAsync<ToiletSessionRow>(query, {
    $cursorEndedAt: options.cursor?.endedAt ?? null,
    $cursorId: options.cursor?.id ?? null,
    $fromDateTime: options.fromDateTime ?? null,
    $queryLimit: limit + 1,
    $toDateTimeExclusive: options.toDateTimeExclusive ?? null,
  });
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1);

  return {
    items: pageRows.map(rowToToiletSession).filter((session): session is ToiletSession => Boolean(session)),
    nextCursor:
      rows.length > limit && lastRow
        ? {
            endedAt: lastRow.ended_at,
            id: lastRow.id,
          }
        : null,
  };
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
