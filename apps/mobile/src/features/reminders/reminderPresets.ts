import {
  DEFAULT_LUNCH_QUIET_HOURS_END,
  DEFAULT_LUNCH_QUIET_HOURS_START,
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
} from './reminderLogic';

export const kegelReminderCounts = [1, 2, 3];

export const quietOptions = [
  {
    description: '夜里让小暗号闭麦',
    ranges: [{ end: DEFAULT_QUIET_HOURS_END, id: 'night', start: DEFAULT_QUIET_HOURS_START }],
    title: '夜间勿扰',
  },
  {
    description: '午休和夜里都安静，适合正常作息',
    ranges: [
      { end: DEFAULT_LUNCH_QUIET_HOURS_END, id: 'lunch', start: DEFAULT_LUNCH_QUIET_HOURS_START },
      { end: DEFAULT_QUIET_HOURS_END, id: 'night', start: DEFAULT_QUIET_HOURS_START },
    ],
    title: '午休 + 夜间',
  },
  {
    description: '小暗号全天待命',
    ranges: [],
    title: '关闭勿扰',
  },
] as const;
