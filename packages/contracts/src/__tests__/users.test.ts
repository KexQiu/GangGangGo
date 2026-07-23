import { describe, expect, it } from 'vitest';

import {
  avatarBackgroundPresetKeySchema,
  avatarConfigSchema,
  avatarEmojiPresetKeySchema,
  updateUserProfileRequestSchema,
  userProfileSchema,
  userSummarySchema,
} from '../index.js';
import { avatarConfig, userProfile, userSummary } from './fixtures.js';

describe('user contracts', () => {
  it.each([
    ['avatarEmojiPresetKeySchema', avatarEmojiPresetKeySchema, 'salute'],
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
