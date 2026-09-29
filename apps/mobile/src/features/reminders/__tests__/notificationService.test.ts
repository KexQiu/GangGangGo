import { beforeEach, expect, it, vi } from 'vitest';
import { syncReminderNotifications } from '../notificationService';
import { defaultReminderSettings } from '../reminderLogic';

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), next: vi.fn(), list: vi.fn(), cancel: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: mocks.schedule,
  getNextTriggerDateAsync: mocks.next,
  getAllScheduledNotificationsAsync: mocks.list,
  cancelScheduledNotificationAsync: mocks.cancel,
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));
const settings = { ...defaultReminderSettings, sedentaryEnabled: true, kegelEnabled: true };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([
    { identifier: 'old-reminder', content: { data: { app: 'xiaotidu', kind: 'sedentary' } } },
    { identifier: 'toilet-stage', content: { data: { app: 'xiaotidu', kind: 'toilet' } } },
  ]);
  mocks.next.mockResolvedValue(new Date(2026, 8, 29, 10).getTime());
});

it('uses bounded daily repeating slots, with no finite DATE window', async () => {
  const result = await syncReminderNotifications(settings);
  expect(result.scheduledCount).toBe(13);
  expect(result.nextReminderAt).toBe(new Date(2026, 8, 29, 10).getTime());
  expect(
    mocks.schedule.mock.calls.every(([request]) => request.trigger.type === 'daily' && !('date' in request.trigger)),
  ).toBe(true);
  expect(mocks.cancel.mock.calls).toEqual([['old-reminder']]);
});

it('continues to use the same recurring slots on day three and after a month', async () => {
  await syncReminderNotifications(settings);
  const first = mocks.schedule.mock.calls.map(([request]) => request);
  for (const day of [3, 31]) {
    mocks.schedule.mockClear();
    mocks.next.mockResolvedValue(new Date(2026, 8, 29 + day, 10).getTime());
    const result = await syncReminderNotifications(settings);
    expect(mocks.schedule.mock.calls.map(([request]) => request)).toEqual(first);
    expect(result.nextReminderAt).toBe(new Date(2026, 8, 29 + day, 10).getTime());
  }
});

it('reports a scheduling failure and clears the partial plan', async () => {
  mocks.schedule.mockRejectedValueOnce(new Error('native scheduler failed'));
  await expect(syncReminderNotifications(settings)).rejects.toThrow('native scheduler failed');
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it('does not report success when the system cannot calculate any next trigger', async () => {
  mocks.next.mockResolvedValueOnce(null);
  await expect(syncReminderNotifications(settings)).rejects.toThrow('下次提醒');
});
