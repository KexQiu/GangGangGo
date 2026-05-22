export type ToiletFeeling = 'smooth' | 'normal' | 'difficult';

export type ToiletTimerStage = 'normal' | 'gentle_warning' | 'strong_warning' | 'overtime' | 'severe_warning';

export type ToiletSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  feeling: ToiletFeeling;
  discomfort: boolean;
  bleeding: boolean;
};
