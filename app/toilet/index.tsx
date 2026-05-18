import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pause, Play, Timer } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import {
  formatToiletDuration,
  getToiletStageCopy,
  getToiletTimerStage,
} from '../../src/features/toilet/toiletLogic';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function ToiletScreen() {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastStageRef = useRef(getToiletTimerStage(0));
  const { colors } = useAppTheme();
  const stage = getToiletTimerStage(elapsedSeconds);
  const stageCopy = getToiletStageCopy(stage);
  const styles = createStyles(colors, stage);
  const hasStarted = Boolean(startedAt);

  useEffect(() => {
    if (!hasStarted || isPaused) {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, isPaused]);

  useEffect(() => {
    if (lastStageRef.current !== stage) {
      lastStageRef.current = stage;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [stage]);

  function startTimer() {
    setStartedAt(new Date().toISOString());
    setElapsedSeconds(0);
    setIsPaused(false);
    lastStageRef.current = getToiletTimerStage(0);
    void Haptics.selectionAsync();
  }

  function endTimer() {
    if (!startedAt) {
      return;
    }

    router.push({
      pathname: routes.toiletComplete,
      params: {
        durationSeconds: elapsedSeconds.toString(),
        startedAt,
      },
    });
  }

  function discardTimer() {
    setStartedAt(null);
    setElapsedSeconds(0);
    setIsPaused(false);
    router.replace(routes.home);
  }

  function confirmDiscardTimer() {
    const wasPaused = isPaused;
    setIsPaused(true);

    Alert.alert('这次不记了？', '放弃后不会保存本次记录，就当小本本没翻开。', [
      {
        onPress: () => setIsPaused(wasPaused),
        style: 'cancel',
        text: '继续营业',
      },
      {
        onPress: discardTimer,
        style: 'destructive',
        text: '不记了',
      },
    ]);
  }

  if (!hasStarted) {
    return (
      <Screen>
        <AppTopBar fallbackHref={routes.home} title="马桶计时" />

        <PageHeader
          eyebrow="马桶计时"
          subtitle="开始后只留计时，不刷信息流，不开小剧场。"
          title="马桶计时器"
        />

        <AppCard muted style={styles.startCard}>
          <View style={styles.startIcon}>
            <Timer color={colors.info} size={38} strokeWidth={2.4} />
          </View>
          <Text style={styles.startTitle}>准备开始营业</Text>
          <Text style={styles.startText}>5 分钟敲门，10 分钟提醒，15 分钟亮红灯。</Text>
        </AppCard>

        <AppButton onPress={startTimer}>开始营业</AppButton>
      </Screen>
    );
  }

  return (
    <Screen bottomSafeArea scroll={false} contentStyle={styles.screenContent}>
      <AppTopBar
        fallbackHref={routes.home}
        onBackPress={confirmDiscardTimer}
        title="计时中"
        variant="close"
      />

      <View>
        <PageHeader eyebrow="马桶计时" subtitle="专心办正事，结束就收工。" title="计时中" />
      </View>

      <AppCard style={styles.timerCard}>
        <View style={styles.timerRing}>
          <Text style={styles.timerText}>{formatToiletDuration(elapsedSeconds)}</Text>
        </View>
        <Text style={styles.stageTitle}>{stageCopy.title}</Text>
        <Text style={styles.stageDescription}>{stageCopy.description}</Text>
      </AppCard>

      <AppCard style={styles.warningCard}>
        <Text style={styles.warningTitle}>阶段提示</Text>
        <Text style={styles.warningText}>
          {stage === 'normal' ? '5 分钟时会敲门提醒：是不是该收工了？' : '如果已经完成，点结束并记一笔。'}
        </Text>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={endTimer} style={styles.actionButton}>
          收工
        </AppButton>
        <AppButton
          onPress={() => setIsPaused((current) => !current)}
          style={styles.actionButton}
          variant="secondary"
        >
          {isPaused ? '继续' : '暂停'}
        </AppButton>
      </View>

      <View style={styles.pauseIndicator}>
        {isPaused ? <Play color={colors.textSubtle} size={16} /> : <Pause color={colors.textSubtle} size={16} />}
      </View>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
type ToiletTimerStage = ReturnType<typeof getToiletTimerStage>;

function createStyles(colors: ThemeColors, stage: ToiletTimerStage) {
  const accentColor = stage === 'normal' ? colors.primary : stage === 'gentle_warning' ? colors.info : colors.warning;
  const accentSoft = stage === 'normal' ? colors.primarySoft : stage === 'gentle_warning' ? colors.infoSoft : colors.warningSoft;

  return StyleSheet.create({
    startCard: {
      alignItems: 'center',
      marginBottom: 18,
      paddingVertical: 34,
    },
    startIcon: {
      alignItems: 'center',
      backgroundColor: colors.infoSoft,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: 20,
      width: 72,
    },
    startTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 10,
    },
    startText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 22,
      textAlign: 'center',
    },
    screenContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingBottom: 24,
      paddingHorizontal: 24,
      paddingTop: 18,
    },
    timerCard: {
      alignItems: 'center',
      borderRadius: 32,
      paddingVertical: 38,
    },
    timerRing: {
      alignItems: 'center',
      backgroundColor: accentSoft,
      borderColor: accentColor,
      borderRadius: 96,
      borderWidth: 8,
      height: 192,
      justifyContent: 'center',
      marginBottom: 26,
      width: 192,
    },
    timerText: {
      color: colors.text,
      fontSize: 54,
      fontWeight: '800',
      letterSpacing: 0,
    },
    stageTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    stageDescription: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    warningCard: {
      backgroundColor: accentSoft,
      borderColor: accentColor,
      padding: 18,
    },
    warningTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 8,
    },
    warningText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
    pauseIndicator: {
      alignItems: 'center',
      height: 18,
      justifyContent: 'center',
      opacity: 0,
    },
  });
}
