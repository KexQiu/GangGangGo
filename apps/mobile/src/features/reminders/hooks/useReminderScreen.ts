import { getReminderHomeSummary, MAX_QUIET_HOURS_RANGES } from '../reminderLogic';
import { addMinutesToTime } from '../reminderPresentation';
import { useReminderStore } from '../reminderStore';
import type { QuietHoursRange } from '../reminderTypes';

export function useReminderScreen() {
  const error = useReminderStore((state) => state.error);
  const isSyncing = useReminderStore((state) => state.isSyncing);
  const permissionStatus = useReminderStore((state) => state.permissionStatus);
  const requestPermissionAndSync = useReminderStore((state) => state.requestPermissionAndSync);
  const scheduledCount = useReminderStore((state) => state.scheduledCount);
  const settings = useReminderStore((state) => state.settings);
  const updateSettings = useReminderStore((state) => state.updateSettings);
  const summary = getReminderHomeSummary(settings);
  const needsPermission = (settings.kegelEnabled || settings.sedentaryEnabled) && permissionStatus !== 'granted';

  async function setKegelEnabled(enabled: boolean) {
    await updateSettings({ kegelEnabled: enabled });
    if (enabled && permissionStatus !== 'granted') await requestPermissionAndSync();
  }

  async function setSedentaryEnabled(enabled: boolean) {
    await updateSettings({ sedentaryEnabled: enabled });
    if (enabled && permissionStatus !== 'granted') await requestPermissionAndSync();
  }

  function updateQuietRanges(ranges: QuietHoursRange[]) {
    const nextRanges = ranges.slice(0, MAX_QUIET_HOURS_RANGES);
    const primaryRange = nextRanges[0];
    void updateSettings({
      quietHoursEnd: primaryRange?.end ?? '00:00',
      quietHoursRanges: nextRanges,
      quietHoursStart: primaryRange?.start ?? '00:00',
    });
  }

  function applyQuietPreset(ranges: readonly QuietHoursRange[]) {
    updateQuietRanges(ranges.map((range) => ({ ...range })));
  }

  function addQuietRange(range: QuietHoursRange) {
    if (settings.quietHoursRanges.length >= MAX_QUIET_HOURS_RANGES) return;
    if (settings.quietHoursRanges.some((item) => item.start === range.start && item.end === range.end)) return;
    updateQuietRanges([...settings.quietHoursRanges, range]);
  }

  function removeQuietRange(rangeId: string) {
    updateQuietRanges(settings.quietHoursRanges.filter((range) => range.id !== rangeId));
  }

  function moveQuietRangeTime(rangeId: string, field: 'end' | 'start', deltaMinutes: number) {
    updateQuietRanges(
      settings.quietHoursRanges.map((range) => {
        if (range.id !== rangeId) return range;
        const nextTime = addMinutesToTime(range[field], deltaMinutes);
        const oppositeField = field === 'start' ? 'end' : 'start';
        return nextTime === range[oppositeField] ? range : { ...range, [field]: nextTime };
      }),
    );
  }

  return {
    addQuietRange,
    applyQuietPreset,
    error,
    isSyncing,
    moveQuietRangeTime,
    needsPermission,
    permissionStatus,
    removeQuietRange,
    requestPermissionAndSync,
    scheduledCount,
    setKegelEnabled,
    setSedentaryEnabled,
    settings,
    summary,
    updateSettings,
  };
}
