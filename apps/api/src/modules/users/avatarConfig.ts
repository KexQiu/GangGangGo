import type { AvatarBackgroundPresetKey, AvatarConfig, AvatarEmojiPresetKey } from '@xiaotidu/contracts';
import { isAvatarBackgroundPresetKey, isAvatarConfig, isAvatarEmojiPresetKey } from '@xiaotidu/contracts';

const avatarStoragePrefix = 'avatar:v1:';
const initialAvatarToken = 'initial';
const defaultAvatarBackground: AvatarBackgroundPresetKey = 'leaf';

const legacyAvatarPresets: Record<string, AvatarConfig | null> = {
  'preset:angel': { background: 'mint', emoji: 'angel' },
  'preset:bear': { background: 'sun', emoji: 'bear' },
  'preset:blush': { background: 'rose', emoji: 'blush' },
  'preset:calm': { background: 'lilac', emoji: 'calm' },
  'preset:cat': { background: 'rose', emoji: 'cat' },
  'preset:chick': { background: 'mint', emoji: 'chick' },
  'preset:cool': { background: 'sky', emoji: 'cool' },
  'preset:determined': { background: 'sun', emoji: 'determined' },
  'preset:dog': { background: 'sun', emoji: 'dog' },
  'preset:fox': { background: 'leaf', emoji: 'fox' },
  'preset:frog': { background: 'leaf', emoji: 'frog' },
  'preset:grin': { background: 'leaf', emoji: 'grin' },
  'preset:hamster': { background: 'sun', emoji: 'hamster' },
  'preset:hug': { background: 'rose', emoji: 'hug' },
  'preset:joy': { background: 'leaf', emoji: 'joy' },
  'preset:koala': { background: 'lilac', emoji: 'koala' },
  'preset:lion': { background: 'sun', emoji: 'lion' },
  'preset:melting': { background: 'lilac', emoji: 'melting' },
  'preset:monkey': { background: 'lilac', emoji: 'monkey' },
  'preset:mouse': { background: 'stone', emoji: 'mouse' },
  'preset:owl': { background: 'sky', emoji: 'owl' },
  'preset:panda': { background: 'lilac', emoji: 'panda' },
  'preset:party': { background: 'rose', emoji: 'party' },
  'preset:penguin': { background: 'sky', emoji: 'penguin' },
  'preset:pig': { background: 'rose', emoji: 'pig' },
  'preset:rabbit': { background: 'rose', emoji: 'rabbit' },
  'preset:salute': null,
  'preset:sleepy': { background: 'stone', emoji: 'sleepy' },
  'preset:smile': { background: 'leaf', emoji: 'smile' },
  'preset:starry': { background: 'sun', emoji: 'starry' },
  'preset:thinking': { background: 'sun', emoji: 'thinking' },
  'preset:tiger': { background: 'sun', emoji: 'tiger' },
  'preset:unicorn': { background: 'rose', emoji: 'unicorn' },
  'preset:wink': { background: 'sky', emoji: 'wink' },
};

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

  return legacyAvatarPresets[value] ?? null;
}

export function normalizeAvatarConfig(value: unknown): AvatarConfig | null {
  if (isAvatarConfig(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return deserializeAvatarConfig(value);
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
