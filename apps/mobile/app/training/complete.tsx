import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, HeartPulse } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { SuccessBurst } from '../../src/components/feedback/SuccessBurst';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { getTrainingPreset } from '../../src/features/training/presets';
import { formatTrainingDuration } from '../../src/features/training/trainingLogic';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    completedRepetitions?: string;
    durationSeconds?: string;
    isCompleted?: string;
    presetId?: string;
  }>();
  const preset = getTrainingPreset(params.presetId);
  const isCompleted = params.isCompleted === 'true';
  const durationSeconds = toNumber(params.durationSeconds);
  const completedRepetitions = toNumber(params.completedRepetitions);
  const iconScale = useRef(new Animated.Value(isCompleted ? 0.72 : 1)).current;
  const [burstKey, setBurstKey] = useState(0);
  const { colors } = useAppTheme();
  const styles = createStyles(colors, isCompleted);

  useEffect(() => {
    if (isCompleted) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBurstKey((current) => current + 1);
      Animated.spring(iconScale, {
        friction: 6,
        tension: 180,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [iconScale, isCompleted]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="菊花抬结果" variant="close" />

      <PageHeader
        eyebrow="菊花抬完成"
        subtitle={isCompleted ? '建议量会慢慢累积，休息和放松也算训练。' : '本次先收工，身体反馈比凑满次数更重要。'}
        title={isCompleted ? '抬得刚刚好' : '先收工'}
      />

      <AppCard muted style={styles.resultCard}>
        {isCompleted ? (
          <View style={styles.burstAnchor}>
            <SuccessBurst playKey={burstKey} size={140} />
          </View>
        ) : null}

        <Animated.View style={[styles.resultIcon, { transform: [{ scale: iconScale }] }]}>
          <CheckCircle2 color={isCompleted ? colors.primaryPressed : colors.warning} size={42} strokeWidth={2.4} />
        </Animated.View>
        <Text style={styles.resultTitle}>{preset.name}</Text>
        <Text style={styles.resultText}>
          {isCompleted
            ? '本次菊花抬按计划完成，小花可以下班一会儿。'
            : `已完成 ${completedRepetitions}/${preset.repetitions} 次，没必要硬凑，身体说了算。`}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTrainingDuration(durationSeconds)}</Text>
            <Text style={styles.statLabel}>用时</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedRepetitions}</Text>
            <Text style={styles.statLabel}>完成次数</Text>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.safetyCard}>
        <HeartPulse color={colors.info} size={22} strokeWidth={2.4} />
        <Text style={styles.safetyText}>如果抬完疼痛、出血或不适加重，先停，别硬练，建议咨询医生。</Text>
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          onPress={() => router.replace(`${routes.trainingSession}?presetId=${preset.id}`)}
          style={styles.actionButton}
          variant="secondary"
        >
          再抬一组
        </AppButton>
        <AppButton onPress={() => router.replace(routes.home)} style={styles.actionButton}>
          回到首页
        </AppButton>
      </View>

      <AppButton onPress={() => router.push(routes.safety)} variant="secondary">
        查看安全指导
      </AppButton>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors, isCompleted: boolean) {
  return StyleSheet.create({
    resultCard: {
      alignItems: 'center',
      marginBottom: 16,
      overflow: 'hidden',
      paddingVertical: 32,
    },
    burstAnchor: {
      alignItems: 'center',
      height: 0,
      justifyContent: 'center',
      position: 'absolute',
      top: 68,
      width: '100%',
      zIndex: 2,
    },
    resultIcon: {
      alignItems: 'center',
      backgroundColor: isCompleted ? colors.primarySoft : colors.warningSoft,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: 20,
      width: 72,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 8,
    },
    resultText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 21,
      marginBottom: 24,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      width: '100%',
    },
    statItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      flex: 1,
      marginHorizontal: 5,
      paddingVertical: 16,
    },
    statValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 6,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    safetyCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    safetyText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
    actions: {
      flexDirection: 'row',
      marginBottom: 14,
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
  });
}

function toNumber(value: string | undefined): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
