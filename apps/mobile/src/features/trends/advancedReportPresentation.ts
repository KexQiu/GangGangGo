import type { AdvancedReportDay, AdvancedReportResponse } from '@xiaotidu/contracts';

export const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

const calendarColumnGap = 5;
const calendarFallbackCellSize = 36;
const calendarMinimumCellSize = 30;

type CalendarDayCell = AdvancedReportDay | null;
export type CalendarMonth = {
  key: string;
  title: string;
  weeks: CalendarDayCell[][];
};

type CalendarColors = {
  info: string;
  primary: string;
  warning: string;
};

export function buildCalendarMonths(days: AdvancedReportDay[]): CalendarMonth[] {
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const monthKeys = Array.from(new Set(sortedDays.map((day) => getMonthKey(day.date))));

  return monthKeys.map((monthKey) => {
    const { month, year } = parseMonthKey(monthKey);
    const monthDays = sortedDays.filter((day) => getMonthKey(day.date) === monthKey);
    const firstDayNumber = Number(monthDays[0]?.date.slice(-2) ?? 1);
    const lastDayNumber = Number(monthDays[monthDays.length - 1]?.date.slice(-2) ?? firstDayNumber);
    const firstVisibleDate = new Date(year, month - 1, firstDayNumber);
    const cells: CalendarDayCell[] = Array.from({ length: getMondayWeekdayIndex(firstVisibleDate) }, () => null);

    for (let dayNumber = firstDayNumber; dayNumber <= lastDayNumber; dayNumber += 1) {
      cells.push(dayByDate.get(formatDateKey(year, month, dayNumber)) ?? null);
    }

    const trailingEmptyCount = (7 - (cells.length % 7)) % 7;
    cells.push(...Array.from({ length: trailingEmptyCount }, () => null));

    return { key: monthKey, title: formatMonthTitle(monthKey), weeks: chunkCalendarWeeks(cells) };
  });
}

export function getDefaultMonthIndex(months: CalendarMonth[], todayDateKey: string) {
  const todayMonthIndex = months.findIndex((month) => month.key === getMonthKey(todayDateKey));
  return todayMonthIndex >= 0 ? todayMonthIndex : Math.max(0, months.length - 1);
}

export function getCalendarCellSize(containerWidth: number) {
  if (containerWidth <= 0) return calendarFallbackCellSize;
  const availableCellSize = (containerWidth - calendarColumnGap * (weekdayLabels.length - 1)) / weekdayLabels.length;
  return Math.max(calendarMinimumCellSize, availableCellSize);
}

export function getTodayDateKey() {
  const now = new Date();
  return formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function formatReportRange(report: AdvancedReportResponse) {
  return `${formatDateLabel(report.startedAt)} - ${formatDateLabel(report.endedAt)}`;
}

export function formatDateLabel(dateKey: string) {
  const [, month = '', day = ''] = dateKey.split('-');
  return `${Number(month)}. ${Number(day)}`;
}

export function formatFullDateLabel(dateKey: string) {
  const [year = '', month = '', day = ''] = dateKey.split('-');
  return `${Number(year)}. ${Number(month)}. ${Number(day)}`;
}

export function formatDayAccessibility(day: AdvancedReportDay) {
  const parts = [
    day.trainingDone ? '菊花抬完成' : '菊花抬未完成',
    day.habitFull ? '小账本满格' : `小账本 ${day.habitCompletion}/4`,
    day.toiletLongMeeting ? '蹲会儿长会' : day.toiletRecorded ? '蹲会儿已记录' : '蹲会儿未记录',
  ];
  return parts.join('，');
}

export function formatHabitStatus(day: AdvancedReportDay) {
  if (day.habitFull || day.habitCompletion >= 4) return `满格 ${day.habitCompletion}/4`;
  if (day.habitCompletion > 0) return `已记 ${day.habitCompletion}/4`;
  return '未记录';
}

export function formatToiletStatus(day: AdvancedReportDay) {
  if (day.toiletLongMeeting) return '长会';
  if (day.toiletRecorded) return '已记录';
  return '未记录';
}

export function getTrainingDotColor(colors: CalendarColors, day: AdvancedReportDay) {
  return day.trainingDone ? colors.primary : 'transparent';
}

export function getHabitDotColor(colors: CalendarColors, day: AdvancedReportDay) {
  return day.habitFull || day.habitCompletion > 0 ? colors.info : 'transparent';
}

export function getToiletDotColor(colors: CalendarColors, day: AdvancedReportDay) {
  return day.toiletRecorded || day.toiletLongMeeting ? colors.warning : 'transparent';
}

export function hasAnyDayRecord(day: AdvancedReportDay) {
  return day.trainingDone || day.habitFull || day.habitCompletion > 0 || day.toiletRecorded || day.toiletLongMeeting;
}

function chunkCalendarWeeks(cells: CalendarDayCell[]) {
  const weeks: CalendarDayCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

function parseMonthKey(monthKey: string) {
  const [year = '0', month = '1'] = monthKey.split('-');
  return { month: Number(month), year: Number(year) };
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function getMondayWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonthTitle(monthKey: string) {
  const [year = '', month = ''] = monthKey.split('-');
  return `${Number(year)} 年 ${Number(month)} 月`;
}
