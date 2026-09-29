import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { trainingEligibilityGuidance } from '../../src/features/safety/healthGuidance';
import { FlowerLiftIcon } from '../../src/features/training/FlowerLiftIcon';
import { trainingPresets } from '../../src/features/training/presets';
import { formatTrainingDuration } from '../../src/features/training/trainingLogic';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../../src/features/training/trainingStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingScreen() {
  const router = useRouter();
  const sessions = useTrainingStore((state) => state.sessions);
  const todayCount = getTodayCompletedTrainingCount(sessions);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="菊花抬" />

      <PageHeader subtitle="选个节奏轻抬轻放。有未完成训练时，点击开始会恢复上次进度。" title="小花今日营业" />

      <AppCard style={styles.guidanceCard}>
        <Text style={styles.summaryTitle}>开始前确认是否适合</Text>
        <Text style={styles.summaryText}>{trainingEligibilityGuidance}</Text>
        <AppButton variant="secondary" onPress={() => router.push(routes.safety)}>
          查看安全与就医说明
        </AppButton>
      </AppCard>

      <AppCard muted style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{todayCount}/2</Text>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{todayCount >= 2 ? '今日记录目标已完成' : '今日菊花抬进度'}</Text>
          <Text style={styles.summaryText}>每天 2 组是应用记录目标，不是医学建议量，不必为凑目标加练。</Text>
        </View>
      </AppCard>

      <View style={styles.list}>
        {trainingPresets.map((preset) => {
          const totalSeconds = preset.repetitions * (preset.contractSeconds + preset.relaxSeconds);

          return (
            <AppCard key={preset.id} style={styles.presetCard}>
              <View style={styles.presetHeader}>
                <View style={styles.iconBadge}>
                  <FlowerLiftIcon color={colors.primaryPressed} presetId={preset.id} size={32} />
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
    guidanceCard: { marginBottom: 18, gap: 12 },
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
