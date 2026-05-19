export type NotificationPermissionState = 'denied' | 'granted' | 'unknown';

export type QuietHoursRange = {
  end: string;
  id: string;
  start: string;
};

export type ReminderSettings = {
  kegelEnabled: boolean;
  kegelTimes: string[];
  privacyMode: boolean;
  quietHoursEnd: string;
  quietHoursRanges: QuietHoursRange[];
  quietHoursStart: string;
  sedentaryEnabled: boolean;
  sedentaryIntervalMinutes: number;
  updatedAt: string;
};

export type ReminderSettingsPatch = Partial<Omit<ReminderSettings, 'updatedAt'>>;

export type ReminderKind = 'kegel' | 'sedentary';
