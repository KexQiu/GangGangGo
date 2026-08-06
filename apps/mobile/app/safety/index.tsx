import { Ban, CheckCircle2, CircleHelp, HeartPulse, ShieldCheck, Stethoscope } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

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
  {
    title: '呼吸别掉线',
    body: '收紧和放松时都正常呼吸。菊花抬不是憋气大赛，轻一点更靠谱。',
  },
  {
    title: '找对小开关',
    body: '感觉像轻轻憋住排气。不要顺手夹臀、收腹或让大腿出来抢戏。',
  },
  {
    title: '抬完要下班',
    body: '每次收紧后都要放松到位，别让小花一直处在加班状态。',
  },
  {
    title: '不要卷过头',
    body: '每天完成建议组数即可。疲劳、不适或症状加重时，先给自己放个假。',
  },
];

const stopTrainingItems: GuidanceItem[] = [
  {
    title: '一疼就暂停',
    body: '不要硬撑，先停止并观察。练习不是靠意志力硬刚。',
  },
  {
    title: '练完更不对劲',
    body: '菊花抬后胀痛、刺痛或排便困难变明显时，先暂停，不要继续加码。',
  },
  {
    title: '特殊时期先问专业队友',
    body: '术后、孕产后或已有疾病时，先听医生或康复师安排，不要自己开进阶副本。',
  },
];

const medicalItems: GuidanceItem[] = [
  {
    title: '明显便血',
    body: '反复出现、出血量增加，或伴随疼痛、头晕时，别先猜，建议尽快就医。',
  },
  {
    title: '剧烈肛门疼痛',
    body: '突然出现或持续不缓解的疼痛，不建议靠练习硬扛。',
  },
  {
    title: '排便习惯明显改变',
    body: '近期突然长期便秘、腹泻，或排便形态明显变化，需要认真看一眼。',
  },
  {
    title: '漏便、失禁或影响生活',
    body: '这类情况需要专业评估。小提督可以帮你记账，但不能替医生拍板。',
  },
];

const mistakeItems: GuidanceItem[] = [
  {
    title: '把菊花抬当万能遥控器',
    body: '它是健康习惯，不是治疗按钮。小提督不诊断、不治疗，也不能替代医生。',
  },
  {
    title: '在厕所开长会',
    body: '如厕时间过长会增加局部压力。手机再精彩，也别把马桶坐成办公椅。',
  },
  {
    title: '拿憋尿当训练',
    body: '不要把中断尿流作为日常练习方式。找感觉可以，长期这么练不合适。',
  },
];

export default function SafetyScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.settings} title="小花说明书" />

      <PageHeader subtitle="平时轻松点，身体亮灯就先暂停。这里不训话，只帮你少走弯路。" title="轻轻练，懂得停" />

      <AppCard muted style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <ShieldCheck color={colors.primaryPressed} size={32} strokeWidth={2.4} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>小花要练，也要会休息</Text>
          <Text style={styles.heroText}>
            菊花抬也就是提肛训练，适合做成日常小习惯。出现疼痛、明显便血或症状加重时，先停止，别和身体较劲，建议咨询医生。
          </Text>
        </View>
      </AppCard>

      <GuidanceSection icon={CheckCircle2} items={correctTrainingItems} title="怎么抬比较不费戏" tone="primary" />

      <GuidanceSection icon={Ban} items={stopTrainingItems} title="这些时候先让小花下班" tone="warning" />

      <GuidanceSection icon={Stethoscope} items={medicalItems} title="这些信号问专业队友" tone="danger" />

      <GuidanceSection icon={CircleHelp} items={mistakeItems} title="常见小翻车" tone="info" />

      <AppCard style={styles.disclaimerCard}>
        <HeartPulse color={colors.info} size={22} strokeWidth={2.4} />
        <Text style={styles.disclaimerText}>
          如果你正在接受肛肠、消化、盆底康复或术后治疗，请以医生和康复师的建议为准。小提督负责提醒和记录，不负责当医生。
        </Text>
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
