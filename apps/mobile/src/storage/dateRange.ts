import { getLocalDateKey } from '../features/habits/habitLogic';

export type LocalDateRange = {
  fromDate: string;
  fromDateTime: string;
  toDateExclusive: string;
  toDateTimeExclusive: string;
};

export function buildLocalDateRange(days: number, now = new Date()): LocalDateRange {
  const safeDays = Math.max(1, Math.floor(days));
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (safeDays - 1));

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  return {
    fromDate: getLocalDateKey(start),
    fromDateTime: start.toISOString(),
    toDateExclusive: getLocalDateKey(end),
    toDateTimeExclusive: end.toISOString(),
  };
}
