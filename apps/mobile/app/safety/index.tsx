import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleHelp,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { showToast } from '../../src/components/toast/AppToast';
import {
  emergencyGuidance,
  healthContentReviewedAt,
  healthSources,
  medicalGuidance,
  trainingEligibilityGuidance,
  trainingGoalGuidance,
} from '../../src/features/safety/healthGuidance';

import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

type GuidanceItem = {
  body: string;
  title: string;
};

const correctTrainingItems: GuidanceItem[] = [
  { title: '正常呼吸', body: '收紧和放松时都正常呼吸，不憋气，也不向下用力。' },
  {
    title: '找到盆底肌',
    body: '想象轻轻忍住排气，向上收缩；避免同时夹臀、收腹或绷紧大腿。不确定动作时，请咨询专业人员。',
  },
  { title: '充分放松', body: '每次收缩后都要充分放松；如果难以放松，先停止练习并寻求专业指导。' },
  { title: '按个人情况安排', body: trainingGoalGuidance },
];

const stopTrainingItems: GuidanceItem[] = [
  { title: '疼痛或不适加重时停练', body: '出现疼痛、胀痛，或排尿排便困难加重时，停止练习并咨询医生，不要靠加练解决。' },
  { title: '开始前确认是否适合', body: trainingEligibilityGuidance },
];

const emergencyItems: GuidanceItem[] = [
  { title: '持续、大量出血或伴头晕、晕厥', body: emergencyGuidance },
  { title: '便血伴剧烈腹痛', body: '请立即寻求急诊帮助。情况紧急时联系当地急救服务，不要自行驾车。' },
];

const medicalItems: GuidanceItem[] = [
  { title: '便血、黑便或疼痛', body: medicalGuidance },
  {
    title: '排便习惯持续改变',
    body: '近期排便频率、形态持续改变，或有持续便秘、腹泻，请咨询医生；伴便血、疼痛等情况时及时就医。',
  },
  { title: '漏便、失禁或影响生活', body: '这些情况需要专业评估。记录可以帮助描述症状，不能代替诊断。' },
];

const mistakeItems: GuidanceItem[] = [
  { title: '把练习当成疾病治疗', body: '小提督提供计时、提醒和记录，不诊断疾病，也不承诺治疗痔疮或便秘。' },
  {
    title: '为凑时间长坐或用力',
    body: '有便意时如厕，办完就离开。避免长时间坐着或持续用力；应用的分钟提醒不是医学安全线，也不是要坐满的目标。',
  },
  {
    title: '排尿时反复中断尿流',
    body: '不要把中断尿流当作日常训练。可先用想象忍住排气的方式找感觉，不确定时请专业人员指导。',
  },
  {
    title: '把每日记录当作健康评分',
    body: '饮水、饮食和活动分档只描述记录，不判断健康是否达标。排便频率因人而异，不必每天排便；持续改变或伴不适时应咨询医生。',
  },
];

export default function SafetyScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.settings} title="安全与就医说明" />

      <PageHeader subtitle="小花说明书：了解练习边界，出现异常时及时求助。" title="安全与就医说明" />

      <AppCard muted style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <ShieldCheck color={colors.primaryPressed} size={32} strokeWidth={2.4} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>先确认是否适合练习</Text>
          <Text style={styles.heroText}>{trainingEligibilityGuidance}</Text>
        </View>
      </AppCard>

      <GuidanceSection icon={AlertTriangle} items={emergencyItems} title="立即寻求急诊帮助" tone="danger" />

      <GuidanceSection icon={Stethoscope} items={medicalItems} title="及时就医或咨询" tone="warning" />

      <GuidanceSection icon={CheckCircle2} items={correctTrainingItems} title="如何收缩与放松" tone="primary" />

      <GuidanceSection icon={Ban} items={stopTrainingItems} title="停练与适用范围" tone="warning" />

      <GuidanceSection icon={CircleHelp} items={mistakeItems} title="常见误区" tone="info" />

      <AppCard style={styles.disclaimerCard}>
        <HeartPulse color={colors.info} size={22} strokeWidth={2.4} />
        <Text style={styles.disclaimerText}>
          如果你正在接受肛肠、消化、盆底康复或术后治疗，请以医生和康复师的建议为准。小提督提供提醒和记录，不能代替医疗评估。
        </Text>
      </AppCard>
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>参考资料</Text>
        <Text style={styles.itemBody}>
          资料核对日期：{healthContentReviewedAt}。适用于一般成人健康教育，个人诊疗建议优先。
        </Text>
        {healthSources.map((source) => (
          <Pressable
            accessibilityRole="link"
            key={source.url}
            onPress={() =>
              void Linking.openURL(source.url).catch(() =>
                showToast('暂时无法打开参考资料，请稍后重试。', { type: 'error' }),
              )
            }
            style={styles.sourceLink}
          >
            <Text style={styles.sourceText}>{source.title}</Text>
          </Pressable>
        ))}
      </AppCard>
    </Screen>
  );
}

type GuidanceSectionProps = {
  icon: typeof ShieldCheck;
  items: GuidanceItem[];
  title: string;
  tone: 'danger' | 'info' | 'primary' | 'warning';
};

function GuidanceSection({ icon: Icon, items, title, tone }: GuidanceSectionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const toneColors = getToneColors(colors, tone);

  return (
    <AppCard style={[styles.sectionCard, { borderColor: toneColors.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: toneColors.soft }]}>
          <Icon color={toneColors.foreground} size={21} strokeWidth={2.4} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.itemList}>
        {items.map((item, index) => (
          <View key={item.title} style={[styles.guidanceItem, index > 0 && styles.guidanceItemSpacing]}>
            <View style={[styles.dot, { backgroundColor: toneColors.foreground }]} />
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function getToneColors(colors: ThemeColors, tone: GuidanceSectionProps['tone']) {
  const toneMap = {
    danger: {
      border: colors.danger,
      foreground: colors.danger,
      soft: colors.dangerSoft,
    },
    info: {
      border: colors.border,
      foreground: colors.info,
      soft: colors.infoSoft,
    },
    primary: {
      border: colors.border,
      foreground: colors.primaryPressed,
      soft: colors.primarySoft,
    },
    warning: {
      border: colors.warning,
      foreground: colors.warning,
      soft: colors.warningSoft,
    },
  };

  return toneMap[tone];
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sourceLink: { paddingVertical: 12 },
    sourceText: { color: colors.info, fontSize: 13, lineHeight: 20, textDecorationLine: 'underline' },
    heroCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginRight: 14,
      width: 56,
    },
    heroCopy: {
      flex: 1,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 7,
    },
    heroText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    sectionCard: {
      marginBottom: 14,
      padding: 18,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 14,
    },
    sectionIcon: {
      alignItems: 'center',
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    sectionTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
    },
    itemList: {
      gap: 13,
    },
    guidanceItem: {
      alignItems: 'flex-start',
      flexDirection: 'row',
    },
    guidanceItemSpacing: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingTop: 13,
    },
    dot: {
      borderRadius: 4,
      height: 8,
      marginRight: 12,
      marginTop: 6,
      width: 8,
    },
    itemCopy: {
      flex: 1,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    itemBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    disclaimerCard: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginTop: 4,
    },
    disclaimerText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
  });
}
