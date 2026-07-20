import { createStyles } from '../styles/toiletStyles';
import { useRouter } from 'expo-router';
import { Armchair, Pause, Play } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';
import { useToiletTimerScreen } from '../hooks/useToiletTimerScreen';
import { formatToiletDuration } from '../toiletLogic';
import type { ToiletTimerStage } from '../toiletTypes';

export default function ToiletScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const timer = useToiletTimerScreen({
    onComplete: ({ durationSeconds, startedAt }) => {
      router.push({
        pathname: routes.toiletComplete,
        params: { durationSeconds: durationSeconds.toString(), startedAt },
      });
    },
    onDiscard: () => router.replace(routes.home),
  });
  const styles = createStyles(colors, timer.stage);

  if (!timer.hasStarted) {
    return (
      <Screen>
        <AppTopBar fallbackHref={routes.home} title="蹲会儿" />
        <PageHeader eyebrow="蹲会儿" subtitle="开始后小花只负责计时和轻提醒。" title="蹲会儿" />
        <AppCard muted style={styles.startCard}>
          <View style={styles.startIcon}>
            <Armchair color={colors.info} size={38} strokeWidth={2.4} />
          </View>
          <Text style={styles.startTitle}>小花开始值班</Text>
          <Text style={styles.startText}>5 分钟看一眼，10 分钟准备收工，时间久了就先结束。</Text>
        </AppCard>
        <AppButton onPress={timer.startTimer}>开始计时</AppButton>
      </Screen>
    );
  }

  return (
    <Screen bottomSafeArea scroll={false} contentStyle={styles.screenContent}>
      <AppTopBar fallbackHref={routes.home} onBackPress={timer.confirmDiscardTimer} title="办正事中" variant="close" />
      <View>
        <PageHeader eyebrow="蹲会儿" subtitle="小花值班中，办完就收工。" title="办正事中" />
      </View>
      <AppCard style={styles.timerCard}>
        <View style={styles.timerRing}>
          <Text style={styles.timerText}>{formatToiletDuration(timer.elapsedSeconds)}</Text>
        </View>
        <Text style={styles.stageTitle}>{timer.stageCopy.title}</Text>
        <Text style={styles.stageDescription}>{timer.stageCopy.description}</Text>
      </AppCard>
      <AppCard style={styles.warningCard}>
        <Text style={styles.warningTitle}>阶段提示</Text>
        <Text style={styles.warningText}>{getStageHintText(timer.stage)}</Text>
      </AppCard>
      <View style={styles.actions}>
        <AppButton onPress={timer.endTimer} style={styles.actionButton}>
          收工
        </AppButton>
        <AppButton onPress={timer.togglePause} style={styles.actionButton} variant="secondary">
          {timer.isPaused ? '继续' : '暂停'}
        </AppButton>
      </View>
      <View style={styles.pauseIndicator}>
        {timer.isPaused ? <Play color={colors.textSubtle} size={16} /> : <Pause color={colors.textSubtle} size={16} />}
      </View>
    </Screen>
  );
}

function getStageHintText(stage: ToiletTimerStage): string {
  switch (stage) {
    case 'gentle_warning':
      return '小花该下班了。如果已经办完，点收工就好。';
    case 'strong_warning':
      return '别再加班了。继续久蹲可能不舒服。';
    case 'overtime':
      return '小花过劳了。先结束，站起来活动一下。';
    case 'severe_warning':
      return '小花过劳了。请先结束，休息一下再说。';
    case 'normal':
    default:
      return '小花值班中。5 分钟后提醒你看一眼时间。';
  }
}
