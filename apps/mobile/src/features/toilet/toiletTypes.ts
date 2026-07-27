export type ToiletFeeling = 'smooth' | 'normal' | 'difficult';

export type ToiletStoolShape = 'hard' | 'formed' | 'loose';

// `other` is retained only to read legacy local and synced records. New records
// intentionally expose the two choices that users can act on.
export type ToiletStoolColor = 'normal' | 'attention' | 'other';

export type ToiletStoolColorOption = Exclude<ToiletStoolColor, 'other'>;

export type ToiletSignal = {
  id: string;
  label: string;
};

export type ToiletSignalPreset = ToiletSignal & {
  createdAt: string;
  updatedAt: string;
};

export type ToiletTimerStage = 'normal' | 'gentle_warning' | 'strong_warning' | 'overtime' | 'severe_warning';

export type ToiletSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  feeling: ToiletFeeling;
  discomfort: boolean;
  bleeding: boolean;
  signals?: ToiletSignal[];
  stoolColor?: ToiletStoolColor | null;
  stoolShape?: ToiletStoolShape | null;
};

export type ToiletRecordDraft = Pick<
  ToiletSession,
  'bleeding' | 'discomfort' | 'durationSeconds' | 'feeling' | 'signals' | 'stoolColor' | 'stoolShape'
>;
