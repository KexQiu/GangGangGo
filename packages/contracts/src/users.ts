import { z } from 'zod';

export const avatarEmojiPresetKeys = [
  'smile',
  'calm',
  'cool',
  'thinking',
  'sleepy',
  'party',
  'angel',
  'determined',
  'grin',
  'wink',
  'starry',
  'hug',
  'joy',
  'melting',
  'blush',
  'yum',
  'slight',
  'laugh',
  'relieved',
  'upside_down',
  'grimace',
  'playful',
  'heart_eyes',
  'touched',
  'nerd',
  'smirk',
  'dizzy',
  'cowboy',
  'salute',
  'shy',
  'love',
  'tongue',
  'mask',
  'monocle',
  'zany',
  'pleading',
  'cat',
  'dog',
  'fox',
  'panda',
  'rabbit',
  'bear',
  'tiger',
  'frog',
  'monkey',
  'penguin',
  'koala',
  'lion',
  'pig',
  'mouse',
  'hamster',
  'chick',
  'owl',
  'unicorn',
  'cow',
  'octopus',
  'sloth',
  'otter',
  'raccoon',
  'seal',
  'whale',
  'dino',
  'bee',
  'ladybug',
  'clover',
  'sunflower',
  'rainbow',
  'moon',
  'star',
  'cloud',
  'peach_fruit',
  'headphones',
] as const;

export const avatarBackgroundPresetKeys = ['leaf', 'mint', 'sky', 'sun', 'peach', 'rose', 'lilac', 'stone'] as const;

export const avatarEmojiPresetKeySchema = z.enum(avatarEmojiPresetKeys);
export const avatarBackgroundPresetKeySchema = z.enum(avatarBackgroundPresetKeys);
export type AvatarEmojiPresetKey = z.infer<typeof avatarEmojiPresetKeySchema>;
export type AvatarBackgroundPresetKey = z.infer<typeof avatarBackgroundPresetKeySchema>;

export const avatarConfigSchema = z
  .object({
    background: avatarBackgroundPresetKeySchema,
    emoji: avatarEmojiPresetKeySchema.nullable(),
  })
  .meta({ id: 'AvatarConfig' });
export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

export const userSummarySchema = z
  .object({
    avatarUrl: avatarConfigSchema.nullable(),
    id: z.string().uuid(),
    nickname: z.string().nullable(),
  })
  .meta({ id: 'UserSummary' });
export type UserSummary = z.infer<typeof userSummarySchema>;

export const userProfileSchema = userSummarySchema.extend({ timezone: z.string().min(1) }).meta({ id: 'UserProfile' });
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateUserProfileRequestSchema = z
  .object({
    avatarUrl: avatarConfigSchema.nullable().optional(),
    nickname: z.string().trim().min(1).max(20).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
  .meta({ id: 'UpdateUserProfileRequest' });
export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileRequestSchema>;

export function isAvatarEmojiPresetKey(value: unknown): value is AvatarEmojiPresetKey {
  return avatarEmojiPresetKeySchema.safeParse(value).success;
}

export function isAvatarBackgroundPresetKey(value: unknown): value is AvatarBackgroundPresetKey {
  return avatarBackgroundPresetKeySchema.safeParse(value).success;
}

export function isAvatarConfig(value: unknown): value is AvatarConfig {
  return avatarConfigSchema.safeParse(value).success;
}
