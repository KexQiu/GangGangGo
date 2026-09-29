export type HabitLevel = 'low' | 'medium' | 'good';
export type BowelStatus = HabitLevel | 'not_today';
export type HabitRecordLevel = BowelStatus;

export type HabitCheckIn = {
  date: string;
  water: HabitLevel | null;
  fiber: HabitLevel | null;
  movement: HabitLevel | null;
  bowel: BowelStatus | null;
  updatedAt: string;
};

export type HabitKey = 'water' | 'fiber' | 'movement' | 'bowel';
