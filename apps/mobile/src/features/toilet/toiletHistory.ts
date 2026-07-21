import { buildLocalDateRange } from '../../storage/dateRange';
import { collectAllPages } from '../../storage/pagination';
import { listToiletSessionsPage, type ToiletSessionCursor } from '../../storage/repositories/toiletRepository';
import { toiletHistoryDays } from './toiletHistoryPresentation';
import { type ToiletSession } from './toiletTypes';

export async function listRecentToiletHistory(now = new Date()): Promise<ToiletSession[]> {
  const range = buildLocalDateRange(toiletHistoryDays, now);

  return collectAllPages<ToiletSession, ToiletSessionCursor>((cursor) =>
    listToiletSessionsPage({
      cursor,
      fromDateTime: range.fromDateTime,
      limit: 250,
      toDateTimeExclusive: range.toDateTimeExclusive,
    }),
  );
}
