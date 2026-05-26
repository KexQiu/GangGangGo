import { Image, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

export const profileAvatarPresets = [
  { background: 'primarySoft', color: 'primaryPressed', key: null, label: '默认' },
  { background: 'primarySoft', color: 'primaryPressed', key: 'preset:mint', label: '薄荷' },
  { background: 'infoSoft', color: 'info', key: 'preset:blue', label: '蓝莓' },
  { background: 'warningSoft', color: 'warning', key: 'preset:sun', label: '小太阳' },
  { background: 'dangerSoft', color: 'danger', key: 'preset:peach', label: '桃子' },
] as const;

type ProfileAvatarPreset = (typeof profileAvatarPresets)[number];

type ProfileAvatarProps = {
  avatarUrl?: null | string;
  nickname?: null | string;
  size?: 'lg' | 'md' | 'sm';
};

const avatarSizes = {
  lg: {
    borderRadius: 32,
    fontSize: 22,
    size: 64,
  },
  md: {
    borderRadius: 26,
    fontSize: 18,
    size: 52,
  },
  sm: {
    borderRadius: 20,
    fontSize: 15,
    size: 40,
  },
};

export function ProfileAvatar({ avatarUrl, nickname, size = 'md' }: ProfileAvatarProps) {
  const { colors } = useAppTheme();
  const preset = getAvatarPreset(avatarUrl);
  const avatarSize = avatarSizes[size];
  const shouldShowImage = Boolean(avatarUrl && !isPresetAvatarUrl(avatarUrl));

  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: colors[preset.background],
          borderRadius: avatarSize.borderRadius,
          height: avatarSize.size,
          width: avatarSize.size,
        },
      ]}
    >
      {shouldShowImage ? (
        <Image
          source={{ uri: avatarUrl ?? undefined }}
          style={[
            styles.image,
            {
              borderRadius: avatarSize.borderRadius,
              height: avatarSize.size,
              width: avatarSize.size,
            },
          ]}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            {
              color: colors[preset.color],
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

export function getAvatarPreset(avatarUrl?: null | string): ProfileAvatarPreset {
  return profileAvatarPresets.find((preset) => preset.key === avatarUrl) ?? profileAvatarPresets[0];
}

function isPresetAvatarUrl(avatarUrl: string) {
  return profileAvatarPresets.some((preset) => preset.key === avatarUrl);
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '900',
    lineHeight: 28,
  },
  image: {
    backgroundColor: 'transparent',
  },
});
