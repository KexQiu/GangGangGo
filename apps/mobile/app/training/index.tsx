import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { FlowerLiftIcon } from '../../src/features/training/FlowerLiftIcon';
import { trainingPresets } from '../../src/features/training/presets';
import { formatTrainingDuration } from '../../src/features/training/trainingLogic';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../../src/features/training/trainingStore';
import { type TrainingPresetId } from '../../src/features/training/trainingTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const presetIconVariants: Record<TrainingPresetId, 'quick' | 'soft' | 'steady'> = {
  beginner: 'soft',
  standard: 'steady',
  quick: 'quick',
};

export default function TrainingScreen() {
  const router = useRouter();
  const sessions = useTrainingStore((state) => state.sessions);
  const todayCount = getTodayCompletedTrainingCount(sessions);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="菊花抬" />

      <PageHeader subtitle="也就是提肛训练。选个节奏，跟着轻抬轻放就行。" title="小花今日营业" />

      <AppCard muted style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{todayCount}/2</Text>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{todayCount >= 2 ? '今日建议量已完成' : '今日菊花抬进度'}</Text>
          <Text style={styles.summaryText}>菊花抬不靠卷，完成建议量后就让肌肉下班。</Text>
        </View>
      </AppCard>

      <View style={styles.list}>
        {trainingPresets.map((preset) => {
          const iconVariant = presetIconVariants[preset.id];
          const totalSeconds = preset.repetitions * (preset.contractSeconds + preset.relaxSeconds);

          return (
            <AppCard key={preset.id} style={styles.presetCard}>
              <View style={styles.presetHeader}>
                <View style={styles.iconBadge}>
                  <FlowerLiftIcon
                    info={colors.primaryPressed}
                    primary={colors.primary}
                    privacy={colors.primaryPressed}
                    size={34}
                    strokeWidth={2.35}
                    surface={colors.surface}
                    variant={iconVariant}
                  />
                </View>
                <View style={styles.presetCopy}>
                  <Text style={styles.presetTitle}>{preset.name}</Text>
                  <Text style={styles.presetDescription}>{preset.description}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>收紧 {preset.contractSeconds} 秒</Text>
                <Text style={styles.metaText}>放松 {preset.relaxSeconds} 秒</Text>
                <Text style={styles.metaText}>{preset.repetitions} 次</Text>
              </View>

              <AppButton
                onPress={() => router.push(`${routes.trainingSession}?presetId=${preset.id}`)}
                style={styles.startButton}
              >
                开始 {formatTrainingDuration(totalSeconds)}
              </AppButton>
            </AppCard>
          );
        })}
      </View>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    summaryCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    summaryValue: {
      color: colors.primaryPressed,
      fontSize: 34,
      fontWeight: '800',
      marginRight: 16,
      minWidth: 70,
    },
    summaryCopy: {
      flex: 1,
    },
    summaryTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 6,
    },
    summaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    list: {
      gap: 14,
    },
    presetCard: {
      padding: 18,
    },
    presetHeader: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    iconBadge: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 24,
      height: 50,
      justifyContent: 'center',
      marginRight: 12,
      width: 50,
    },
    presetCopy: {
      flex: 1,
    },
    presetTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 6,
    },
    presetDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    metaText: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginRight: 8,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    startButton: {
      minHeight: 50,
    },
  });
}
