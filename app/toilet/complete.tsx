import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, CheckCircle2, CircleDot, Frown, Smile } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { OptionRow } from '../../src/components/OptionRow';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { formatToiletDuration, isLongToiletSession } from '../../src/features/toilet/toiletLogic';
import { useToiletStore } from '../../src/features/toilet/toiletStore';
import { type ToiletFeeling, type ToiletSession } from '../../src/features/toilet/toiletTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const feelingOptions: Array<{
  description: string;
  feeling: ToiletFeeling;
  icon: typeof Smile;
  title: string;
}> = [
  {
    description: '顺利收工，没什么波澜',
    feeling: 'smooth',
    icon: Smile,
    title: '顺畅',
  },
  {
    description: '能收工，但不算轻松',
    feeling: 'normal',
    icon: CircleDot,
    title: '一般',
  },
  {
    description: '费劲或用时久，值得记一下',
    feeling: 'difficult',
    icon: Frown,
    title: '困难',
  },
];

export default function ToiletCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    durationSeconds?: string;
    startedAt?: string;
  }>();
  const addSession = useToiletStore((state) => state.addSession);
  const durationSeconds = toNumber(params.durationSeconds);
  const startedAt = typeof params.startedAt === 'string' ? params.startedAt : new Date().toISOString();
  const [feeling, setFeeling] = useState<ToiletFeeling>('normal');
  const [discomfort, setDiscomfort] = useState(false);
  const [bleeding, setBleeding] = useState(false);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const hasRedFlag = bleeding || discomfort;
  const hasLongToilet = isLongToiletSession(durationSeconds);
  const shouldShowRisk = hasRedFlag || hasLongToilet;

  async function saveSession() {
    if (!shouldShowRisk) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const session: ToiletSession = {
      bleeding,
      discomfort,
      durationSeconds,
      endedAt: new Date().toISOString(),
      feeling,
      id: createSessionId(),
      startedAt,
    };

    await addSession(session);
    router.replace(routes.home);
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="收工记录" variant="close" />

      <PageHeader
        eyebrow="收工记录"
        subtitle="简单记一笔就行，不用写马桶小作文。"
        title={`用时 ${formatToiletDuration(durationSeconds)}`}
      />

      <Text style={styles.groupTitle}>收工体验</Text>
      <View style={styles.optionGroup}>
        {feelingOptions.map((option) => (
          <OptionRow
            description={option.description}
            icon={option.icon}
            key={option.feeling}
            onPress={() => setFeeling(option.feeling)}
            selected={feeling === option.feeling}
            title={option.title}
          />
        ))}
      </View>

      <Text style={styles.groupTitle}>红灯信号</Text>
      <View style={styles.optionGroup}>
        <OptionRow
          description="先给小花放假，别硬练"
          icon={AlertTriangle}
          onPress={() => setDiscomfort((current) => !current)}
          selected={discomfort}
          title="明显不舒服"
        />
        <OptionRow
          description="这不是普通打卡项目，建议问医生"
          icon={AlertTriangle}
          onPress={() => setBleeding((current) => !current)}
          selected={bleeding}
          title="明显便血"
        />
      </View>

      {hasRedFlag ? (
        <AppCard style={styles.riskCard}>
          <View style={styles.riskHeader}>
            <AlertTriangle color={colors.danger} size={22} strokeWidth={2.4} />
            <Text style={styles.riskText}>
              这类信号别靠意志力硬扛。肛肛好不能判断病因，建议尽快咨询肛肠科、消化科或专业医生。
            </Text>
          </View>
          <AppButton onPress={() => router.push(routes.safety)} style={styles.riskButton} variant="secondary">
            查看安全说明
          </AppButton>
        </AppCard>
      ) : hasLongToilet ? (
        <AppCard style={styles.longSessionCard}>
          <View style={styles.riskHeader}>
            <AlertTriangle color={colors.warning} size={22} strokeWidth={2.4} />
            <Text style={styles.riskText}>
              这次马桶会开得有点久。先收工、少刷一会儿，让小花别把马桶当工位。
            </Text>
          </View>
          <AppButton onPress={() => router.push(routes.safety)} style={styles.riskButton} variant="warning">
            看看怎么少开长会
          </AppButton>
        </AppCard>
      ) : (
        <AppCard muted style={styles.noteCard}>
          <CheckCircle2 color={colors.primaryPressed} size={22} strokeWidth={2.4} />
          <Text style={styles.noteText}>收工已入账，首页会同步更新。记一笔就够，不用加班。</Text>
        </AppCard>
      )}

      <AppButton onPress={saveSession}>记好了</AppButton>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    groupTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
    },
    optionGroup: {
      marginBottom: 18,
    },
    riskCard: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      marginBottom: 18,
    },
    longSessionCard: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      marginBottom: 18,
    },
    riskHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginBottom: 14,
    },
    riskText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
    riskButton: {
      minHeight: 46,
    },
    noteCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    noteText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
  });
}

function toNumber(value: string | undefined): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
