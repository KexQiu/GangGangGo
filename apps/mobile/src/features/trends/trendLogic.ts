import { calculateHabitCompletion, getLocalDateKey } from '../habits/habitLogic';
import { type HabitCheckIn } from '../habits/habitTypes';
import { isLongToiletSession } from '../toilet/toiletLogic';
import { type ToiletSession } from '../toilet/toiletTypes';
import { type TrainingSession } from '../training/trainingTypes';

export type TrendInput = {
  habitCheckIns: HabitCheckIn[];
  toiletSessions: ToiletSession[];
  trainingSessions: TrainingSession[];
};

export type DailyTrend = {
  dateKey: string;
  habitCompletion: number;
  habitFull: boolean;
  label: string;
  longToiletCount: number;
  redFlagCount: number;
  toiletSessionCount: number;
  trainingCompletedCount: number;
};

export type SevenDayTrend = {
  days: DailyTrend[];
  habitFullDays: number;
  hasAnyRecord: boolean;
  longToiletCount: number;
  redFlagCount: number;
  toiletRecordDays: number;
  trainingActiveDays: number;
};

export type ThirtyDaySummary = {
  days: number;
  habitFullDays: number;
  hasAnyRecord: boolean;
  longToiletCount: number;
  redFlagCount: number;
  toiletRecordDays: number;
  totalHabitItems: number;
  totalTrainingCompleted: number;
  trainingActiveDays: number;
};

export type TrendPositiveFeedback = {
  body: string;
  title: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function buildSevenDayTrend(input: TrendInput, now = new Date()): SevenDayTrend {
  const days = buildDailyTrends(input, 7, now);

  return {
    days,
    habitFullDays: days.filter((day) => day.habitFull).length,
    hasAnyRecord: days.some(hasAnyDailyRecord),
    longToiletCount: sumBy(days, (day) => day.longToiletCount),
    redFlagCount: sumBy(days, (day) => day.redFlagCount),
    toiletRecordDays: days.filter((day) => day.toiletSessionCount > 0).length,
    trainingActiveDays: days.filter((day) => day.trainingCompletedCount > 0).length,
  };
}

export function buildThirtyDaySummary(input: TrendInput, now = new Date()): ThirtyDaySummary {
  const days = buildDailyTrends(input, 30, now);

  return {
    days: 30,
    habitFullDays: days.filter((day) => day.habitFull).length,
    hasAnyRecord: days.some(hasAnyDailyRecord),
    longToiletCount: sumBy(days, (day) => day.longToiletCount),
    redFlagCount: sumBy(days, (day) => day.redFlagCount),
    toiletRecordDays: days.filter((day) => day.toiletSessionCount > 0).length,
    totalHabitItems: sumBy(days, (day) => day.habitCompletion),
    totalTrainingCompleted: sumBy(days, (day) => day.trainingCompletedCount),
    trainingActiveDays: days.filter((day) => day.trainingCompletedCount > 0).length,
  };
}

export function getTrendPositiveFeedback(summary: SevenDayTrend): TrendPositiveFeedback {
  if (!summary.hasAnyRecord) {
    return {
      body: '先记一件小事，今天就不是空白页。',
      title: '小报告还没开张',
    };
  }

  if (summary.redFlagCount > 0) {
    return {
      body: '这周有需要留意的小信号，先看小花说明书，别急着刷成绩。',
      title: '这周先照顾身体',
    };
  }

  if (summary.trainingActiveDays >= 5 && summary.habitFullDays >= 5 && summary.longToiletCount === 0) {
    return {
      body: '小花训练达标，小账本也给力，蹲会儿长会没来凑热闹。',
      title: '这周节奏很顺',
    };
  }

  if (summary.trainingActiveDays > 0 && summary.habitFullDays > 0) {
    return {
      body: `小花训练达标 ${summary.trainingActiveDays} 天，小账本满格 ${summary.habitFullDays} 天。`,
      title: '节奏感已经出来了',
    };
  }

  if (summary.trainingActiveDays > 0) {
    return {
      body: `这周训练达标 ${summary.trainingActiveDays} 天，轻轻来就算数。`,
      title: '小花有达标',
    };
  }

  if (summary.habitFullDays > 0) {
    return {
      body: `满格 ${summary.habitFullDays} 天，习惯线索越来越清楚。`,
      title: '小账本有在工作',
    };
  }

  if (summary.longToiletCount > 0) {
    return {
      body: `这周蹲会儿长会 ${summary.longToiletCount} 次，知道就好，下次早点散会。`,
      title: '长会被抓到了',
    };
  }

  return {
    body: '已经有记录了，继续轻轻补上就好。',
    title: '小报告开始有线索',
  };
}

function buildDailyTrends(input: TrendInput, days: number, now: Date): DailyTrend[] {
  return buildDateRange(days, now).map((date) => {
    const dateKey = getLocalDateKey(date);
    const habitCheckIn = input.habitCheckIns.find((checkIn) => checkIn.date === dateKey);
    const toiletSessions = input.toiletSessions.filter((session) => isSameLocalDate(new Date(session.endedAt), date));
    const trainingSessions = input.trainingSessions.filter(
      (session) => session.isCompleted && isSameLocalDate(new Date(session.endedAt), date),
    );
    const habitCompletion = calculateHabitCompletion(habitCheckIn);

    return {
      dateKey,
      habitCompletion,
      habitFull: habitCompletion >= 4,
      label: formatDayLabel(date, now),
      longToiletCount: toiletSessions.filter((session) => isLongToiletSession(session.durationSeconds)).length,
      redFlagCount: toiletSessions.filter((session) => session.bleeding || session.discomfort).length,
      toiletSessionCount: toiletSessions.length,
      trainingCompletedCount: trainingSessions.length,
    };
  });
}

function buildDateRange(days: number, now: Date): Date[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - 1 - index) * DAY_IN_MS);
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

function formatDayLabel(date: Date, now: Date): string {
  if (isSameLocalDate(date, now)) {
    return '今天';
  }

  const yesterday = new Date(now.getTime() - DAY_IN_MS);
  if (isSameLocalDate(date, yesterday)) {
    return '昨天';
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function hasAnyDailyRecord(day: DailyTrend): boolean {
  return day.trainingCompletedCount > 0 || day.habitCompletion > 0 || day.toiletSessionCount > 0;
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function sumBy(items: DailyTrend[], mapper: (item: DailyTrend) => number): number {
  return items.reduce((total, item) => total + mapper(item), 0);
}
