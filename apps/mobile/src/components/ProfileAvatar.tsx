import { StyleSheet, Text, View } from 'react-native';

import type { AvatarBackgroundPresetKey, AvatarConfig, AvatarEmojiPresetKey } from '@xiaotidu/contracts';
import { isAvatarConfig } from '@xiaotidu/contracts';

import { useAppTheme } from '../theme/themeProvider';

export const defaultProfileAvatarConfig: AvatarConfig = {
  background: 'leaf',
  emoji: null,
};

export const profileAvatarEmojiPresets = [
  { emoji: '😄', key: 'smile', label: '开心' },
  { emoji: '😌', key: 'calm', label: '稳住' },
  { emoji: '😎', key: 'cool', label: '酷酷' },
  { emoji: '🤔', key: 'thinking', label: '思考' },
  { emoji: '😴', key: 'sleepy', label: '困困' },
  { emoji: '🥳', key: 'party', label: '元气' },
  { emoji: '😇', key: 'angel', label: '乖巧' },
  { emoji: '😤', key: 'determined', label: '加油' },
  { emoji: '😁', key: 'grin', label: '咧嘴笑' },
  { emoji: '😉', key: 'wink', label: '眨眼' },
  { emoji: '🤩', key: 'starry', label: '星星眼' },
  { emoji: '🤗', key: 'hug', label: '抱抱' },
  { emoji: '😂', key: 'joy', label: '大笑' },
  { emoji: '🫠', key: 'melting', label: '融化' },
  { emoji: '☺️', key: 'blush', label: '害羞' },
  { emoji: '😋', key: 'yum', label: '满足' },
  { emoji: '🙂', key: 'slight', label: '微笑' },
  { emoji: '😆', key: 'laugh', label: '笑眯眯' },
  { emoji: '😮‍💨', key: 'relieved', label: '松口气' },
  { emoji: '🙃', key: 'upside_down', label: '倒着笑' },
  { emoji: '😬', key: 'grimace', label: '咬牙' },
  { emoji: '😜', key: 'playful', label: '调皮' },
  { emoji: '😍', key: 'heart_eyes', label: '喜欢' },
  { emoji: '🥹', key: 'touched', label: '感动' },
  { emoji: '🤓', key: 'nerd', label: '认真' },
  { emoji: '😏', key: 'smirk', label: '得意' },
  { emoji: '😵‍💫', key: 'dizzy', label: '转圈' },
  { emoji: '🤠', key: 'cowboy', label: '牛仔' },
  { emoji: '🐱', key: 'cat', label: '小猫' },
  { emoji: '🐶', key: 'dog', label: '小狗' },
  { emoji: '🦊', key: 'fox', label: '狐狸' },
  { emoji: '🐼', key: 'panda', label: '熊猫' },
  { emoji: '🐰', key: 'rabbit', label: '兔子' },
  { emoji: '🐻', key: 'bear', label: '小熊' },
  { emoji: '🐯', key: 'tiger', label: '老虎' },
  { emoji: '🐸', key: 'frog', label: '青蛙' },
  { emoji: '🐵', key: 'monkey', label: '猴子' },
  { emoji: '🐧', key: 'penguin', label: '企鹅' },
  { emoji: '🐨', key: 'koala', label: '考拉' },
  { emoji: '🦁', key: 'lion', label: '狮子' },
  { emoji: '🐷', key: 'pig', label: '小猪' },
  { emoji: '🐭', key: 'mouse', label: '小鼠' },
  { emoji: '🐹', key: 'hamster', label: '仓鼠' },
  { emoji: '🐥', key: 'chick', label: '小鸡' },
  { emoji: '🦉', key: 'owl', label: '猫头鹰' },
  { emoji: '🦄', key: 'unicorn', label: '独角兽' },
  { emoji: '🐮', key: 'cow', label: '小牛' },
  { emoji: '🐙', key: 'octopus', label: '章鱼' },
] as const satisfies readonly {
  emoji: string;
  key: AvatarEmojiPresetKey;
  label: string;
}[];

export const profileAvatarEmojiOptions = [
  { emoji: null, key: null, label: '默认' },
  ...profileAvatarEmojiPresets,
] as const satisfies readonly {
  emoji: null | string;
  key: AvatarEmojiPresetKey | null;
  label: string;
}[];

export const profileAvatarBackgroundPresets = [
  {
    dark: '#173D2C',
    foregroundDark: '#41D492',
    foregroundLight: '#1E8F62',
    key: 'leaf',
    label: '叶绿',
    light: '#DDF5E9',
  },
  {
    dark: '#123C38',
    foregroundDark: '#66E1D1',
    foregroundLight: '#08746A',
    key: 'mint',
    label: '薄荷',
    light: '#DDF8F3',
  },
  {
    dark: '#17395C',
    foregroundDark: '#73A3FF',
    foregroundLight: '#2F6EDB',
    key: 'sky',
    label: '天空',
    light: '#E4EEFF',
  },
  {
    dark: '#4A3513',
    foregroundDark: '#FDBA3B',
    foregroundLight: '#B86A00',
    key: 'sun',
    label: '暖阳',
    light: '#FFF3D6',
  },
  {
    dark: '#55311F',
    foregroundDark: '#FFB088',
    foregroundLight: '#C45F2A',
    key: 'peach',
    label: '蜜桃',
    light: '#FFE9DC',
  },
  {
    dark: '#4A1F2C',
    foregroundDark: '#FF8FA8',
    foregroundLight: '#C83257',
    key: 'rose',
    label: '玫瑰',
    light: '#FFE5EC',
  },
  {
    dark: '#34265F',
    foregroundDark: '#B197FF',
    foregroundLight: '#7357D8',
    key: 'lilac',
    label: '丁香',
    light: '#EEE7FF',
  },
  {
    dark: '#26312C',
    foregroundDark: '#B9C8BF',
    foregroundLight: '#65746B',
    key: 'stone',
    label: '石灰',
    light: '#EEF2EF',
  },
] as const satisfies readonly {
  dark: string;
  foregroundDark: string;
  foregroundLight: string;
  key: AvatarBackgroundPresetKey;
  label: string;
  light: string;
}[];

type ProfileAvatarProps = {
  avatarUrl?: AvatarConfig | null | string;
  nickname?: null | string;
  size?: 'lg' | 'md' | 'sm' | 'xs';
};

const avatarSizes = {
  lg: {
    borderRadius: 32,
    emojiFontSize: 30,
    fontSize: 22,
    size: 64,
  },
  md: {
    borderRadius: 26,
    emojiFontSize: 25,
    fontSize: 18,
    size: 52,
  },
  sm: {
    borderRadius: 20,
    emojiFontSize: 20,
    fontSize: 15,
    size: 40,
  },
  xs: {
    borderRadius: 17,
    emojiFontSize: 17,
    fontSize: 13,
    size: 34,
  },
};

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

export function ProfileAvatar({ avatarUrl, nickname, size = 'md' }: ProfileAvatarProps) {
  const { resolvedScheme } = useAppTheme();
  const avatarConfig = getAvatarConfig(avatarUrl);
  const background = getAvatarBackgroundPreset(avatarConfig.background);
  const emoji = avatarConfig.emoji ? getAvatarEmoji(avatarConfig.emoji) : null;
  const avatarSize = avatarSizes[size];
  const backgroundColor = resolvedScheme === 'dark' ? background.dark : background.light;
  const foregroundColor = resolvedScheme === 'dark' ? background.foregroundDark : background.foregroundLight;

  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor,
          borderRadius: avatarSize.borderRadius,
          height: avatarSize.size,
          width: avatarSize.size,
        },
      ]}
    >
      {emoji ? (
        <Text
          style={[
            styles.emoji,
            {
              fontSize: avatarSize.emojiFontSize,
              lineHeight: avatarSize.emojiFontSize + 6,
            },
          ]}
        >
          {emoji}
        </Text>
      ) : (
        <Text
          style={[
            styles.initial,
            {
              color: foregroundColor,
              fontSize: avatarSize.fontSize,
            },
          ]}
        >
          {getAvatarInitial(nickname)}
        </Text>
      )}
    </View>
  );
}

export function getAvatarInitial(nickname?: null | string) {
  return nickname?.trim().slice(0, 1) || '小';
}

export function getAvatarConfig(avatarUrl?: AvatarConfig | null | string): AvatarConfig {
  return getNullableAvatarConfig(avatarUrl) ?? defaultProfileAvatarConfig;
}

export function getNullableAvatarConfig(avatarUrl?: AvatarConfig | null | string): AvatarConfig | null {
  if (!avatarUrl) {
    return null;
  }

  if (isAvatarConfig(avatarUrl)) {
    return avatarUrl;
  }

  return legacyAvatarPresets[avatarUrl] ?? null;
}

export function getAvatarBackgroundPreset(key: AvatarBackgroundPresetKey) {
  return profileAvatarBackgroundPresets.find((preset) => preset.key === key) ?? profileAvatarBackgroundPresets[0];
}

function getAvatarEmoji(key: AvatarEmojiPresetKey) {
  return profileAvatarEmojiPresets.find((preset) => preset.key === key)?.emoji ?? null;
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    includeFontPadding: false,
    textAlign: 'center',
  },
  initial: {
    fontWeight: '900',
    lineHeight: 28,
  },
});
