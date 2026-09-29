import { AppState } from 'react-native';
import { useReminderStore } from './reminderStore';

function calendarKey() {
  const now = new Date();
  return `${now.toDateString()}:${now.getTimezoneOffset()}:${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
}

/** 每日重复通知由系统持续调度；前台校准权限、日期、时区和下一次提醒显示。 */
export function startReminderLifecycle() {
  let lastCalendarKey = calendarKey();
  function refresh(force = false) {
    const state = useReminderStore.getState();
    if (!state.hasHydrated || state.isSyncing) return;
    const key = calendarKey();
    if (force || key !== lastCalendarKey || (state.nextReminderAt !== null && state.nextReminderAt <= Date.now())) {
      lastCalendarKey = key;
      void state.syncSchedule();
    }
  }
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') refresh(true);
  });
  const timer = setInterval(() => {
    if (AppState.currentState === 'active') refresh();
  }, 60_000);
  return () => {
    subscription.remove();
    clearInterval(timer);
  };
}
