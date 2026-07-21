import type { AdvancedReportDay } from '@xiaotidu/contracts';

import { getLocalDateKey } from '../habits/habitLogic';
import { isLongToiletSession } from './toiletLogic';
import { type ToiletSession } from './toiletTypes';

export const toiletHistoryDays = 90;

export function buildLocalToiletHistoryCalendarDays(
  toiletSessions: ToiletSession[],
  now = new Date(),
): AdvancedReportDay[] {
  const sessionsByDate = new Map<string, ToiletSession[]>();
  for (const session of toiletSessions) {
    const date = getLocalDateKey(new Date(session.endedAt));
    const sessions = sessionsByDate.get(date) ?? [];
    sessions.push(session);
    sessionsByDate.set(date, sessions);
  }

  return Array.from({ length: toiletHistoryDays }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (toiletHistoryDays - 1 - index));
    const dateKey = getLocalDateKey(date);
    const sessions = sessionsByDate.get(dateKey) ?? [];

    return {
      date: dateKey,
      habitCompletion: 0,
      habitFull: false,
      toiletLongMeeting: sessions.some((session) => isLongToiletSession(session.durationSeconds)),
      toiletRecorded: sessions.length > 0,
      trainingDone: false,
    };
  });
}

export function mergeToiletHistoryIntoCalendarDays(
  days: AdvancedReportDay[],
  toiletSessions: ToiletSession[],
): AdvancedReportDay[] {
  const localDays = new Map(buildLocalToiletHistoryCalendarDays(toiletSessions).map((day) => [day.date, day]));

  return days.map((day) => {
    const localDay = localDays.get(day.date);
    if (!localDay) return day;

    return {
      ...day,
      toiletLongMeeting: day.toiletLongMeeting || localDay.toiletLongMeeting,
      toiletRecorded: day.toiletRecorded || localDay.toiletRecorded,
    };
  });
}
