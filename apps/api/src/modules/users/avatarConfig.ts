import type { AvatarBackgroundPresetKey, AvatarConfig, AvatarEmojiPresetKey } from '@xiaotidu/contracts';
import { isAvatarBackgroundPresetKey, isAvatarConfig, isAvatarEmojiPresetKey } from '@xiaotidu/contracts';

const avatarStoragePrefix = 'avatar:v1:';
const initialAvatarToken = 'initial';
const defaultAvatarBackground: AvatarBackgroundPresetKey = 'leaf';

export function deserializeAvatarConfig(value: null | string): AvatarConfig | null {
  if (!value) {
    return null;
  }

  if (value.startsWith(avatarStoragePrefix)) {
    const [, , emojiToken, backgroundToken] = value.split(':');
    const emoji = parseStoredEmojiToken(emojiToken);

    if (emojiToken !== initialAvatarToken && !emoji) {
      return null;
    }

    if (!isAvatarBackgroundPresetKey(backgroundToken)) {
      return null;
    }

    return {
      background: backgroundToken,
      emoji,
    };
  }

  return null;
}

export function normalizeAvatarConfig(value: unknown): AvatarConfig | null {
  if (isAvatarConfig(value)) {
    return value;
  }

  return null;
}

export function serializeAvatarConfig(value: AvatarConfig | null): string | null {
  if (!value) {
    return null;
  }

  const avatar = normalizeAvatarConfig(value);

  if (!avatar) {
    return null;
  }

  return `${avatarStoragePrefix}${avatar.emoji ?? initialAvatarToken}:${avatar.background}`;
}

function parseStoredEmojiToken(value: string | undefined): AvatarEmojiPresetKey | null {
  if (value === initialAvatarToken) {
    return null;
  }

  return isAvatarEmojiPresetKey(value) ? value : null;
}

export function getDefaultAvatarConfig(): AvatarConfig {
  return {
    background: defaultAvatarBackground,
    emoji: null,
  };
}
