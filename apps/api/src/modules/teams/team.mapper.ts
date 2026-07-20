import type { DailyShareSnapshot, ShareSettings, Team, TeamDailyShareSnapshot, TeamMember } from '@xiaotidu/contracts';

import { dailyShareSnapshots, shareSettings } from '../../db/schema.js';
import type { MemberRecord, TeamRecord } from './team.types.js';

export const defaultShareSettings: ShareSettings = {
  paused: false,
  shareHabitCompletion: true,
  shareStreak: true,
  shareToiletRecorded: true,
  shareTraining: true,
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

export function toTeam(team: TeamRecord, members: MemberRecord[]): Team {
  return {
    id: team.id,
    members: members.map(toTeamMember),
    name: team.name,
    ownerUserId: team.ownerUserId,
  };
}

export function toTeamMember(member: MemberRecord): TeamMember {
  return {
    displayName: member.displayName,
    id: member.id,
    joinedAt: toIsoString(member.joinedAt),
    role: member.role,
    status: member.status,
    user: member.user,
  };
}

export function normalizeShareSettings(input?: Partial<ShareSettings>): ShareSettings {
  return {
    ...defaultShareSettings,
    ...input,
  };
}

export function applyShareSettings(
  snapshot: DailyShareSnapshot | null,
  settings: ShareSettings,
): TeamDailyShareSnapshot | null {
  if (!snapshot || settings.paused) {
    return null;
  }

  return {
    date: snapshot.date,
    ...(settings.shareTraining ? { trainingDone: snapshot.trainingDone } : {}),
    ...(settings.shareHabitCompletion ? { habitCompletion: snapshot.habitCompletion } : {}),
    ...(settings.shareToiletRecorded ? { toiletRecorded: snapshot.toiletRecorded } : {}),
    ...(settings.shareStreak ? { streakDays: snapshot.streakDays } : {}),
  };
}

export function toShareSettings(record: typeof shareSettings.$inferSelect): ShareSettings {
  return {
    paused: record.paused,
    shareHabitCompletion: record.shareHabitCompletion,
    shareStreak: record.shareStreak,
    shareToiletRecorded: record.shareToiletRecorded,
    shareTraining: record.shareTraining,
  };
}

export function toDailyShareSnapshot(record: typeof dailyShareSnapshots.$inferSelect): DailyShareSnapshot {
  return {
    date: record.date,
    habitCompletion: record.habitCompletion as DailyShareSnapshot['habitCompletion'],
    streakDays: record.streakDays,
    toiletRecorded: record.toiletRecorded,
    trainingDone: record.trainingDone,
  };
}
