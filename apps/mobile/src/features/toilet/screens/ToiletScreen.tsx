import { createStyles } from '../styles/toiletStyles';
import { useRouter } from 'expo-router';
import { Armchair } from 'lucide-react-native';
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
import { PendingToiletRecords } from '../components/PendingToiletRecords';

export default function ToiletScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const timer = useToiletTimerScreen({
    onComplete: ({ draftId }) => {
      router.push({
        pathname: routes.toiletComplete,
        params: { draftId },
      });
    },
    onDiscard: () => router.replace(routes.home),
  });
  const styles = createStyles(colors, timer.stage);

  if (!timer.hasStarted) {
    return (
      <Screen>
        <AppTopBar fallbackHref={routes.home} title="蹲会儿" />
        <PageHeader subtitle="开始后小花只负责计时和轻提醒。" title="蹲会儿" />
        <PendingToiletRecords />
        <AppCard muted style={styles.startCard}>
          <View style={styles.startIcon}>
            <Armchair color={colors.info} size={38} strokeWidth={2.4} />
          </View>
          <Text style={styles.startTitle}>小花开始值班</Text>
          <Text style={styles.startText}>办完就离开，不必等提醒。5/10/15/20 分钟是应用提醒节点，不是医学安全线。</Text>
        </AppCard>
        <AppButton onPress={timer.startTimer}>开始计时</AppButton>
      </Screen>
    );
  }

  return (
    <Screen
      bottomSafeArea
      contentStyle={styles.screenContent}
      footer={
        <View style={styles.actions}>
          <AppButton disabled={timer.isFinishing} onPress={() => void timer.endTimer()} style={styles.actionButton}>
            {timer.isFinishing ? '保存草稿中…' : '收工'}
          </AppButton>
          <AppButton
            disabled={timer.isFinishing}
            onPress={timer.togglePause}
            style={styles.actionButton}
            variant="secondary"
          >
            {timer.isPaused ? '继续' : '暂停'}
          </AppButton>
        </View>
      }
    >
      <AppTopBar fallbackHref={routes.home} onBackPress={timer.confirmDiscardTimer} title="办正事中" variant="close" />
      <View>
        <PageHeader subtitle="小花值班中，办完就收工。" title="办正事中" />
      </View>
      <PendingToiletRecords />
      <AppCard style={styles.timerCard}>
        <View style={styles.timerRing}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.timerText}>
            {formatToiletDuration(timer.elapsedSeconds)}
          </Text>
        </View>
        <Text style={styles.stageTitle}>{timer.stageCopy.title}</Text>
        <Text style={styles.stageDescription}>{timer.stageCopy.description}</Text>
      </AppCard>
      <AppCard style={styles.warningCard}>
        <Text style={styles.warningTitle}>阶段提示</Text>
        <Text style={styles.warningText}>{getStageHintText(timer.stage)}</Text>
      </AppCard>
    </Screen>
  );
}

function getStageHintText(stage: ToiletTimerStage): string {
  switch (stage) {
    case 'gentle_warning':
      return '小花该下班了。如果已经办完，点收工就好。';
    case 'strong_warning':
      return '已持续 10 分钟，请先结束，避免长时间坐着。';
    case 'overtime':
      return '已持续 15 分钟，请先结束，避免持续用力。';
    case 'severe_warning':
      return '已持续 20 分钟，请先结束，稍后有便意再尝试。';
    case 'normal':
    default:
      return '小花值班中。5 分钟后提醒你看一眼时间。';
  }
}
