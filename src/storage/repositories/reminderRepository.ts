import {
  defaultReminderSettings,
  normalizeReminderSettings,
} from '../../features/reminders/reminderLogic';
import { type QuietHoursRange, type ReminderSettings } from '../../features/reminders/reminderTypes';
import { initializeDatabase } from '../db';

const SETTINGS_ID = 'default';

type ReminderSettingsRow = {
  id: string;
  kegel_enabled: number;
  kegel_times: string;
  privacy_mode: number;
  quiet_hours_end: string;
  quiet_hours_ranges: string | null;
  quiet_hours_start: string;
  sedentary_enabled: number;
  sedentary_interval_minutes: number;
  updated_at: string;
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const db = await initializeDatabase();
  const row = await db.getFirstAsync<ReminderSettingsRow>(
    `
      SELECT
        id,
        kegel_enabled,
        kegel_times,
        sedentary_enabled,
        sedentary_interval_minutes,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_ranges,
        privacy_mode,
        updated_at
      FROM reminder_settings
      WHERE id = $id;
    `,
    { $id: SETTINGS_ID },
  );

  if (!row) {
    return {
      ...defaultReminderSettings,
      updatedAt: new Date().toISOString(),
    };
  }

  return normalizeReminderSettings(rowToReminderSettings(row));
}

export async function upsertReminderSettings(settings: ReminderSettings): Promise<void> {
  const db = await initializeDatabase();

  await db.runAsync(
    `
      INSERT INTO reminder_settings (
        id,
        kegel_enabled,
        kegel_times,
        sedentary_enabled,
        sedentary_interval_minutes,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_ranges,
        privacy_mode,
        updated_at
      ) VALUES (
        $id,
        $kegelEnabled,
        $kegelTimes,
        $sedentaryEnabled,
        $sedentaryIntervalMinutes,
        $quietHoursStart,
        $quietHoursEnd,
        $quietHoursRanges,
        $privacyMode,
        $updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        kegel_enabled = excluded.kegel_enabled,
        kegel_times = excluded.kegel_times,
        sedentary_enabled = excluded.sedentary_enabled,
        sedentary_interval_minutes = excluded.sedentary_interval_minutes,
        quiet_hours_start = excluded.quiet_hours_start,
        quiet_hours_end = excluded.quiet_hours_end,
        quiet_hours_ranges = excluded.quiet_hours_ranges,
        privacy_mode = excluded.privacy_mode,
        updated_at = excluded.updated_at;
    `,
    {
      $id: SETTINGS_ID,
      $kegelEnabled: settings.kegelEnabled ? 1 : 0,
      $kegelTimes: JSON.stringify(settings.kegelTimes),
      $privacyMode: settings.privacyMode ? 1 : 0,
      $quietHoursEnd: settings.quietHoursEnd,
      $quietHoursRanges: JSON.stringify(settings.quietHoursRanges),
      $quietHoursStart: settings.quietHoursStart,
      $sedentaryEnabled: settings.sedentaryEnabled ? 1 : 0,
      $sedentaryIntervalMinutes: settings.sedentaryIntervalMinutes,
      $updatedAt: settings.updatedAt,
    },
  );
}

function rowToReminderSettings(row: ReminderSettingsRow): ReminderSettings {
  return {
    kegelEnabled: Boolean(row.kegel_enabled),
    kegelTimes: parseKegelTimes(row.kegel_times),
    privacyMode: Boolean(row.privacy_mode),
    quietHoursEnd: row.quiet_hours_end,
    quietHoursRanges: parseQuietHoursRanges(row.quiet_hours_ranges),
    quietHoursStart: row.quiet_hours_start,
    sedentaryEnabled: Boolean(row.sedentary_enabled),
    sedentaryIntervalMinutes: row.sedentary_interval_minutes,
    updatedAt: row.updated_at,
  };
}

function parseQuietHoursRanges(value: string | null): QuietHoursRange[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is QuietHoursRange => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const range = item as Partial<QuietHoursRange>;
      return typeof range.id === 'string' && typeof range.start === 'string' && typeof range.end === 'string';
    });
  } catch {
    return [];
  }
}

function parseKegelTimes(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
