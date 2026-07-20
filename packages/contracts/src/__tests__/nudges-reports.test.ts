import { describe, expect, it } from 'vitest';

import {
  ackBuddyNudgeRequestSchema,
  advancedReportDaySchema,
  advancedReportRangeSchema,
  advancedReportResponseSchema,
  advancedReportSummariesSchema,
  advancedReportSummarySchema,
  buddyNudgeAckResponseSchema,
  buddyNudgeAckSchema,
  buddyNudgeAckStatusSchema,
  buddyNudgeDailyLimitSchema,
  buddyNudgeSchema,
  buddyNudgeSettingsResponseSchema,
  buddyNudgeSettingsSchema,
  buddyNudgeThreadResponseSchema,
  buddyNudgeTypeSchema,
  buddyNudgesResponseSchema,
  createBuddyNudgeRequestSchema,
  dailyReportSnapshotResponseSchema,
  dailyReportSnapshotSchema,
  dailyReportSnapshotsBulkResponseSchema,
  nudgeThreadSummarySchema,
  nudgeThreadsResponseSchema,
  teamWeeklyReportResponseSchema,
  updateBuddyNudgeSettingsRequestSchema,
  upsertDailyReportSnapshotRequestSchema,
  upsertDailyReportSnapshotsBulkRequestSchema,
} from '../index.js';
import {
  DATE,
  NOW,
  USER_B_ID,
  advancedReportDay,
  advancedReportSummary,
  buddySummary,
  dailyReportSnapshot,
  nudge,
  nudgeAck,
  nudgeSettings,
  teamMember,
} from './fixtures.js';

describe('nudge contracts', () => {
  const threadSummary = {
    buddy: buddySummary,
    latestAt: NOW,
    latestPreview: '起来动一动',
    messageCount: 3,
    pendingCount: 1,
    status: 'active',
  };

  it.each([
    ['buddyNudgeTypeSchema', buddyNudgeTypeSchema, 'gentle'],
    ['buddyNudgeAckStatusSchema', buddyNudgeAckStatusSchema, 'received'],
    ['buddyNudgeDailyLimitSchema', buddyNudgeDailyLimitSchema, 5],
    ['buddyNudgeAckSchema', buddyNudgeAckSchema, nudgeAck],
    ['buddyNudgeSchema', buddyNudgeSchema, nudge],
    ['createBuddyNudgeRequestSchema', createBuddyNudgeRequestSchema, { toUserId: USER_B_ID, type: 'move' }],
    ['ackBuddyNudgeRequestSchema', ackBuddyNudgeRequestSchema, { status: 'done' }],
    ['buddyNudgeAckResponseSchema', buddyNudgeAckResponseSchema, { ack: nudgeAck }],
    ['buddyNudgesResponseSchema', buddyNudgesResponseSchema, { nudges: [nudge] }],
    [
      'buddyNudgeThreadResponseSchema',
      buddyNudgeThreadResponseSchema,
      { hasMore: true, nextCursor: NOW, nudges: [nudge] },
    ],
    ['nudgeThreadSummarySchema', nudgeThreadSummarySchema, threadSummary],
    ['nudgeThreadsResponseSchema', nudgeThreadsResponseSchema, { threads: [threadSummary] }],
    ['buddyNudgeSettingsSchema', buddyNudgeSettingsSchema, nudgeSettings],
    ['buddyNudgeSettingsResponseSchema', buddyNudgeSettingsResponseSchema, { settings: [nudgeSettings] }],
    [
      'updateBuddyNudgeSettingsRequestSchema',
      updateBuddyNudgeSettingsRequestSchema,
      { dailyLimit: 3, enabled: true, quietRanges: [] },
    ],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts all daily limits, ACK revisions, optional cursors, and quiet-range limits', () => {
    for (const limit of [0, 3, 5, 8]) {
      expect(buddyNudgeDailyLimitSchema.safeParse(limit).success).toBe(true);
    }
    expect(buddyNudgeAckSchema.safeParse({ ...nudgeAck, revisionCount: 1 }).success).toBe(true);
    expect(buddyNudgeThreadResponseSchema.safeParse({ hasMore: false, nextCursor: null, nudges: [] }).success).toBe(
      true,
    );
    expect(
      updateBuddyNudgeSettingsRequestSchema.safeParse({
        dailyLimit: 8,
        enabled: false,
        quietRanges: [
          { end: '07:00', start: '23:00' },
          { end: '12:00', start: '11:00' },
          { end: '17:00', start: '16:00' },
          { end: '22:00', start: '21:00' },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects invalid enums, limits, cursors, counters, and quiet ranges', () => {
    expect(buddyNudgeTypeSchema.safeParse('custom').success).toBe(false);
    expect(buddyNudgeAckStatusSchema.safeParse('read').success).toBe(false);
    expect(buddyNudgeDailyLimitSchema.safeParse(4).success).toBe(false);
    expect(buddyNudgeAckSchema.safeParse({ ...nudgeAck, revisionCount: 2 }).success).toBe(false);
    expect(
      buddyNudgeThreadResponseSchema.safeParse({ hasMore: true, nextCursor: 'yesterday', nudges: [] }).success,
    ).toBe(false);
    expect(nudgeThreadSummarySchema.safeParse({ ...threadSummary, pendingCount: -1 }).success).toBe(false);
    expect(
      updateBuddyNudgeSettingsRequestSchema.safeParse({
        dailyLimit: 3,
        enabled: true,
        quietRanges: Array(5).fill({ end: '07:00', start: '23:00' }),
      }).success,
    ).toBe(false);
  });

  it('rejects unknown request fields and malformed quiet ranges', () => {
    expect(
      createBuddyNudgeRequestSchema.safeParse({ message: 'custom', toUserId: USER_B_ID, type: 'move' }).success,
    ).toBe(false);
    expect(ackBuddyNudgeRequestSchema.safeParse({ status: 'done', revision: 1 }).success).toBe(false);
    expect(
      updateBuddyNudgeSettingsRequestSchema.safeParse({
        dailyLimit: 3,
        enabled: true,
        quietRanges: [{ end: '23:60', start: '23:00' }],
      }).success,
    ).toBe(false);
  });
});

describe('report contracts', () => {
  const advancedResponse = {
    days: [advancedReportDay],
    endedAt: DATE,
    range: '90d',
    snapshot: dailyReportSnapshot,
    startedAt: '2026-04-15',
    summaries: {
      '7d': advancedReportSummary,
      '30d': advancedReportSummary,
      '90d': advancedReportSummary,
    },
  };
  const weeklyResponse = {
    endedAt: DATE,
    memberCount: 1,
    startedAt: '2026-07-07',
    summaries: [
      {
        habitFullDays: 3,
        member: {
          displayName: teamMember.displayName,
          id: teamMember.id,
          user: teamMember.user,
        },
        toiletRecordedDays: 2,
        trainingDays: 1,
      },
    ],
  };

  it.each([
    ['dailyReportSnapshotSchema', dailyReportSnapshotSchema, dailyReportSnapshot],
    [
      'upsertDailyReportSnapshotRequestSchema',
      upsertDailyReportSnapshotRequestSchema,
      { snapshot: dailyReportSnapshot },
    ],
    [
      'upsertDailyReportSnapshotsBulkRequestSchema',
      upsertDailyReportSnapshotsBulkRequestSchema,
      { snapshots: [dailyReportSnapshot] },
    ],
    ['dailyReportSnapshotResponseSchema', dailyReportSnapshotResponseSchema, { snapshot: dailyReportSnapshot }],
    [
      'dailyReportSnapshotsBulkResponseSchema',
      dailyReportSnapshotsBulkResponseSchema,
      { snapshots: [dailyReportSnapshot] },
    ],
    ['advancedReportRangeSchema', advancedReportRangeSchema, '90d'],
    ['advancedReportDaySchema', advancedReportDaySchema, advancedReportDay],
    ['advancedReportSummarySchema', advancedReportSummarySchema, advancedReportSummary],
    [
      'advancedReportSummariesSchema',
      advancedReportSummariesSchema,
      { '7d': advancedReportSummary, '30d': advancedReportSummary, '90d': advancedReportSummary },
    ],
    ['advancedReportResponseSchema', advancedReportResponseSchema, advancedResponse],
    ['teamWeeklyReportResponseSchema', teamWeeklyReportResponseSchema, weeklyResponse],
  ])('%s accepts a legal value', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it('accepts one and ninety snapshots at bulk boundaries', () => {
    expect(upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: [dailyReportSnapshot] }).success).toBe(
      true,
    );
    expect(
      upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: Array(90).fill(dailyReportSnapshot) }).success,
    ).toBe(true);
  });

  it('rejects invalid ranges, dates, counters, and bulk sizes', () => {
    expect(dailyReportSnapshotSchema.safeParse({ ...dailyReportSnapshot, date: '2026-02-30' }).success).toBe(false);
    expect(dailyReportSnapshotSchema.safeParse({ ...dailyReportSnapshot, bleeding: true }).success).toBe(false);
    expect(upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: [] }).success).toBe(false);
    expect(
      upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ snapshots: Array(91).fill(dailyReportSnapshot) }).success,
    ).toBe(false);
    expect(advancedReportRangeSchema.safeParse('30d').success).toBe(false);
    expect(advancedReportSummarySchema.safeParse({ ...advancedReportSummary, recordDays: -1 }).success).toBe(false);
    expect(teamWeeklyReportResponseSchema.safeParse({ ...weeklyResponse, memberCount: 1.5 }).success).toBe(false);
  });

  it('rejects unknown bulk and single-upsert request fields', () => {
    expect(
      upsertDailyReportSnapshotRequestSchema.safeParse({ dryRun: true, snapshot: dailyReportSnapshot }).success,
    ).toBe(false);
    expect(
      upsertDailyReportSnapshotsBulkRequestSchema.safeParse({ replace: true, snapshots: [dailyReportSnapshot] })
        .success,
    ).toBe(false);
  });
});
