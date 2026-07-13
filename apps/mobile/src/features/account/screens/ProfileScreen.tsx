import { createStyles } from '../styles/profileStyles';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { AvatarConfig } from '@xiaotidu/contracts';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { PageStack } from '../../../components/PageStack';
import {
  getAvatarBackgroundPreset,
  getAvatarConfig,
  getNullableAvatarConfig,
  ProfileAvatar,
  profileAvatarBackgroundPresets,
  profileAvatarEmojiOptions,
} from '../../../components/ProfileAvatar';
import { Screen } from '../../../components/Screen';
import { useCurrentUserQuery, useUpdateProfileMutation } from '../../../features/account/accountQueries';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { colors, resolvedScheme } = useAppTheme();
  const styles = createStyles(colors);
  const user = useCurrentUserQuery().data;
  const updateProfile = useUpdateProfileMutation();
  const [nicknameDraft, setNicknameDraft] = useState(user?.nickname ?? '');
  const [avatarDraft, setAvatarDraft] = useState<AvatarConfig | null>(() => getNullableAvatarConfig(user?.avatarUrl));
  const [isAvatarPickerVisible, setIsAvatarPickerVisible] = useState(false);
  const normalizedNickname = nicknameDraft.trim();
  const avatarDraftConfig = getAvatarConfig(avatarDraft);
  const avatarPresetRows = chunkItems(profileAvatarEmojiOptions, 6);
  const hasChanges = Boolean(
    user &&
    (normalizedNickname !== user.nickname ||
      !areAvatarConfigsEqual(avatarDraft, getNullableAvatarConfig(user.avatarUrl))),
  );
  const canSave = Boolean(user && normalizedNickname && hasChanges && !updateProfile.isPending);

  useEffect(() => {
    setNicknameDraft(user?.nickname ?? '');
    setAvatarDraft(getNullableAvatarConfig(user?.avatarUrl));
    setIsAvatarPickerVisible(false);
  }, [user?.avatarUrl, user?.nickname]);

  async function handleSave() {
    if (!canSave) {
      return;
    }

    try {
      await updateProfile.mutateAsync({
        avatarUrl: avatarDraft,
        nickname: normalizedNickname,
      });
      router.replace(routes.me);
    } catch {
      // Mutation errors are surfaced by the shared account Query handler.
    }
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.me} title="编辑资料" />

      <PageStack gap="regular">
        {!user ? (
          <AppCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>先登录小提督</Text>
            <Text style={styles.emptyBody}>登录后才能编辑头像和昵称。</Text>
            <AppButton onPress={() => router.replace(routes.me)}>回到我的</AppButton>
          </AppCard>
        ) : (
          <AppCard style={styles.profileCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>昵称</Text>
              <TextInput
                accessibilityLabel="昵称"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
                onChangeText={setNicknameDraft}
                placeholder="输入昵称"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.primary}
                style={styles.input}
                value={nicknameDraft}
              />
            </View>

            <View style={styles.avatarSection}>
              <Text style={styles.fieldLabel}>头像</Text>
              <View style={styles.avatarHeader}>
                <ProfileAvatar avatarUrl={avatarDraft} nickname={normalizedNickname} size="lg" />
                <AppButton
                  onPress={() => setIsAvatarPickerVisible((visible) => !visible)}
                  style={styles.avatarButton}
                  variant="secondary"
                >
                  更换头像
                </AppButton>
              </View>

              {isAvatarPickerVisible ? (
                <View style={styles.avatarPicker}>
                  <View style={styles.backgroundGrid}>
                    {profileAvatarBackgroundPresets.map((preset) => {
                      const background = getAvatarBackgroundPreset(preset.key);
                      const backgroundColor = resolvedScheme === 'dark' ? background.dark : background.light;
                      const isSelected = avatarDraftConfig.background === preset.key;

                      return (
                        <PressableScale
                          accessibilityLabel={`${preset.label}背景`}
                          accessibilityState={{ selected: isSelected }}
                          key={preset.key}
                          onPress={() =>
                            setAvatarDraft({
                              ...avatarDraftConfig,
                              background: preset.key,
                            })
                          }
                          style={styles.backgroundOption}
                        >
                          <View style={[styles.backgroundSwatch, { backgroundColor }]}>
                            {isSelected ? <View style={styles.selectedDot} /> : null}
                          </View>
                        </PressableScale>
                      );
                    })}
                  </View>

                  <View style={styles.avatarGrid}>
                    {avatarPresetRows.map((row, rowIndex) => (
                      <View key={`avatar-row-${rowIndex}`} style={styles.avatarRow}>
                        {row.map((preset) => {
                          const isSelected = avatarDraftConfig.emoji === preset.key;
                          const optionAvatar: AvatarConfig = {
                            background: avatarDraftConfig.background,
                            emoji: preset.key,
                          };

                          return (
                            <PressableScale
                              accessibilityLabel={`${preset.label}头像`}
                              accessibilityState={{ selected: isSelected }}
                              key={preset.key ?? 'default'}
                              onPress={() =>
                                setAvatarDraft({
                                  ...avatarDraftConfig,
                                  emoji: preset.key,
                                })
                              }
                              style={styles.avatarOption}
                            >
                              <ProfileAvatar avatarUrl={optionAvatar} nickname={normalizedNickname} size="xs" />
                              {isSelected ? <View style={styles.selectedDot} /> : null}
                            </PressableScale>
                          );
                        })}
                        {Array.from({ length: 6 - row.length }).map((_, placeholderIndex) => (
                          <View
                            key={`avatar-row-${rowIndex}-placeholder-${placeholderIndex}`}
                            style={styles.avatarPlaceholder}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            <AppButton disabled={!canSave} onPress={() => void handleSave()}>
              保存资料
            </AppButton>
          </AppCard>
        )}
      </PageStack>
    </Screen>
  );
}

function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function areAvatarConfigsEqual(left: AvatarConfig | null, right: AvatarConfig | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.emoji === right.emoji && left.background === right.background;
}
