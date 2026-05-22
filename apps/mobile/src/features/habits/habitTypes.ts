export type HabitLevel = 'low' | 'medium' | 'good';

export type HabitCheckIn = {
  date: string;
  water: HabitLevel | null;
  fiber: HabitLevel | null;
  movement: HabitLevel | null;
  bowel: HabitLevel | null;
  updatedAt: string;
};

export type HabitKey = 'water' | 'fiber' | 'movement' | 'bowel';
