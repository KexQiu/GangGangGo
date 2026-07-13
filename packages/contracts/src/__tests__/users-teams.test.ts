import { describe, expect, it } from 'vitest';

import {
  acceptTeamInviteRequestSchema,
  avatarBackgroundPresetKeySchema,
  avatarConfigSchema,
  avatarEmojiPresetKeySchema,
  createTeamInviteResponseSchema,
  createTeamRequestSchema,
  dailyShareSnapshotResponseSchema,
  dailyShareSnapshotSchema,
  habitCompletionSchema,
  shareSettingsResponseSchema,
  shareSettingsSchema,
  teamDailyShareSnapshotSchema,
  teamInvitePreviewResponseSchema,
  teamMemberRoleSchema,
  teamMemberSchema,
  teamMemberStatusSchema,
  teamResponseSchema,
  teamSchema,
  teamSnapshotSchema,
  teamSnapshotsResponseSchema,
  updateTeamMemberStatusRequestSchema,
  updateTeamRequestSchema,
  updateUserProfileRequestSchema,
  upsertDailyShareSnapshotRequestSchema,
  userProfileSchema,
  userSummarySchema,
} from '../index.js';
import {
  DATE,
  MEMBER_ID,
  NOW,
  TEAM_ID,
  avatarConfig,
  dailyShareSnapshot,
  shareSettings,
  team,
  teamMember,
  userProfile,
  userSummary,
} from './fixtures.js';

describe('user contracts', () => {
  it.each([
    ['avatarEmojiPresetKeySchema', avatarEmojiPresetKeySchema, 'smile'],
    ['avatarBackgroundPresetKeySchema', avatarBackgroundPresetKeySchema, 'leaf'],
    ['avatarConfigSchema', avatarConfigSchema, avatarConfig],
    ['userSummarySchema', userSummarySchema, userSummary],
    ['userProfileSchema', userProfileSchema, userProfile],
    ['updateUserProfileRequestSchema', updateUserProfileRequestSchema, { nickname: '小梯度' }],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts profile length boundaries and optional updates', () => {
    expect(updateUserProfileRequestSchema.safeParse({}).success).toBe(true);
    expect(updateUserProfileRequestSchema.safeParse({ nickname: 'a', timezone: 'x' }).success).toBe(true);
    expect(
      updateUserProfileRequestSchema.safeParse({ nickname: 'n'.repeat(20), timezone: 'z'.repeat(64) }).success,
    ).toBe(true);
    expect(updateUserProfileRequestSchema.safeParse({ avatarUrl: null, nickname: null }).success).toBe(true);
  });

  it('rejects invalid presets, UUIDs, lengths, types, and unknown fields', () => {
    expect(avatarEmojiPresetKeySchema.safeParse('missing').success).toBe(false);
    expect(avatarBackgroundPresetKeySchema.safeParse('purple').success).toBe(false);
    expect(userSummarySchema.safeParse({ ...userSummary, id: 'not-a-uuid' }).success).toBe(false);
    expect(userProfileSchema.safeParse({ ...userProfile, timezone: '' }).success).toBe(false);
    expect(updateUserProfileRequestSchema.safeParse({ nickname: '' }).success).toBe(false);
    expect(updateUserProfileRequestSchema.safeParse({ nickname: 'n'.repeat(21) }).success).toBe(false);
    expect(updateUserProfileRequestSchema.safeParse({ timezone: false }).success).toBe(false);
    expect(updateUserProfileRequestSchema.safeParse({ locale: 'zh-CN' }).success).toBe(false);
  });
});

describe('team contracts', () => {
  const teamSnapshot = {
    member: {
      displayName: teamMember.displayName,
      id: teamMember.id,
      role: teamMember.role,
      status: teamMember.status,
      user: teamMember.user,
    },
    shareSettings,
    snapshot: dailyShareSnapshot,
  };

  it.each([
    ['habitCompletionSchema', habitCompletionSchema, 4],
    ['dailyShareSnapshotSchema', dailyShareSnapshotSchema, dailyShareSnapshot],
    ['upsertDailyShareSnapshotRequestSchema', upsertDailyShareSnapshotRequestSchema, { snapshot: dailyShareSnapshot }],
    ['dailyShareSnapshotResponseSchema', dailyShareSnapshotResponseSchema, { snapshot: dailyShareSnapshot }],
    ['teamMemberRoleSchema', teamMemberRoleSchema, 'owner'],
    ['teamMemberStatusSchema', teamMemberStatusSchema, 'active'],
    ['teamMemberSchema', teamMemberSchema, teamMember],
    ['teamSchema', teamSchema, team],
    ['teamResponseSchema', teamResponseSchema, { team }],
    ['createTeamRequestSchema', createTeamRequestSchema, {}],
    ['updateTeamRequestSchema', updateTeamRequestSchema, { name: '新小队' }],
    ['updateTeamMemberStatusRequestSchema', updateTeamMemberStatusRequestSchema, { status: 'paused' }],
    ['shareSettingsSchema', shareSettingsSchema, shareSettings],
    ['shareSettingsResponseSchema', shareSettingsResponseSchema, { settings: shareSettings }],
    [
      'createTeamInviteResponseSchema',
      createTeamInviteResponseSchema,
      { expiresAt: NOW, inviteId: TEAM_ID, inviteUrl: 'https://example.com/invite/token', token: 'token' },
    ],
    [
      'teamInvitePreviewResponseSchema',
      teamInvitePreviewResponseSchema,
      { expiresAt: NOW, inviterNickname: null, teamName: '测试小队' },
    ],
    ['acceptTeamInviteRequestSchema', acceptTeamInviteRequestSchema, {}],
    ['teamDailyShareSnapshotSchema', teamDailyShareSnapshotSchema, { date: DATE }],
    ['teamSnapshotSchema', teamSnapshotSchema, teamSnapshot],
    ['teamSnapshotsResponseSchema', teamSnapshotsResponseSchema, { date: DATE, snapshots: [teamSnapshot] }],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts numeric and text boundaries', () => {
    expect(habitCompletionSchema.safeParse(0).success).toBe(true);
    expect(habitCompletionSchema.safeParse(4).success).toBe(true);
    expect(createTeamRequestSchema.safeParse({ name: 'a' }).success).toBe(true);
    expect(createTeamRequestSchema.safeParse({ name: 'n'.repeat(40) }).success).toBe(true);
    expect(acceptTeamInviteRequestSchema.safeParse({ displayName: 'd'.repeat(40) }).success).toBe(true);
    expect(teamResponseSchema.safeParse({ team: null }).success).toBe(true);
  });

  it('rejects out-of-range values, invalid enums, and malformed records', () => {
    expect(habitCompletionSchema.safeParse(-1).success).toBe(false);
    expect(habitCompletionSchema.safeParse(5).success).toBe(false);
    expect(habitCompletionSchema.safeParse(1.5).success).toBe(false);
    expect(dailyShareSnapshotSchema.safeParse({ ...dailyShareSnapshot, streakDays: -1 }).success).toBe(false);
    expect(teamMemberRoleSchema.safeParse('admin').success).toBe(false);
    expect(teamMemberStatusSchema.safeParse('pending').success).toBe(false);
    expect(teamMemberSchema.safeParse({ ...teamMember, id: MEMBER_ID.slice(1) }).success).toBe(false);
    expect(createTeamRequestSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateTeamRequestSchema.safeParse({ name: 'n'.repeat(41) }).success).toBe(false);
    expect(updateTeamMemberStatusRequestSchema.safeParse({ status: 'removed' }).success).toBe(false);
  });

  it('rejects unknown request and nested share fields', () => {
    expect(
      upsertDailyShareSnapshotRequestSchema.safeParse({ snapshot: dailyShareSnapshot, userId: 'unexpected' }).success,
    ).toBe(false);
    expect(createTeamRequestSchema.safeParse({ color: 'green' }).success).toBe(false);
    expect(updateTeamMemberStatusRequestSchema.safeParse({ reason: 'away', status: 'paused' }).success).toBe(false);
    expect(shareSettingsSchema.safeParse({ ...shareSettings, shareHealthDetails: true }).success).toBe(false);
    expect(acceptTeamInviteRequestSchema.safeParse({ displayName: '搭子', role: 'owner' }).success).toBe(false);
  });
});
