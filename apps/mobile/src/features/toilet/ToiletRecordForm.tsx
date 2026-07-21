import { AlertTriangle, CircleDot, Frown, Pencil, Plus, Smile, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { useAppTheme } from '../../theme/themeProvider';
import { isLongToiletSession, formatToiletDuration } from './toiletLogic';
import {
  builtInToiletSignals,
  MAX_TOILET_SIGNALS_PER_SESSION,
  normalizeToiletSignalLabel,
  toiletStoolColorOptions,
  toiletStoolShapeOptions,
} from './toiletRecordLogic';
import { type ToiletFeeling, type ToiletRecordDraft, type ToiletSignal, type ToiletSignalPreset } from './toiletTypes';
import {
  createToiletSignalPreset,
  deleteToiletSignalPreset,
  listToiletSignalPresets,
} from '../../storage/repositories/toiletRepository';

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

type ToiletRecordFormProps = {
  initialValue: ToiletRecordDraft;
  onOpenSafety?: () => void;
  onSubmit: (draft: ToiletRecordDraft) => Promise<void>;
  submitLabel: string;
};

export function ToiletRecordForm({ initialValue, onOpenSafety, onSubmit, submitLabel }: ToiletRecordFormProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [durationSeconds, setDurationSeconds] = useState(initialValue.durationSeconds);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(() =>
    Math.floor(initialValue.durationSeconds / 60).toString(),
  );
  const [durationSecondPart, setDurationSecondPart] = useState(() => (initialValue.durationSeconds % 60).toString());
  const [feeling, setFeeling] = useState<ToiletFeeling>(initialValue.feeling);
  const [discomfort, setDiscomfort] = useState(initialValue.discomfort);
  const [bleeding, setBleeding] = useState(initialValue.bleeding);
  const [stoolShape, setStoolShape] = useState(initialValue.stoolShape ?? null);
  const [stoolColor, setStoolColor] = useState(initialValue.stoolColor ?? null);
  const [signals, setSignals] = useState<ToiletSignal[]>(initialValue.signals ?? []);
  const [customSignals, setCustomSignals] = useState<ToiletSignalPreset[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(true);
  const [isManagingSignals, setIsManagingSignals] = useState(false);
  const [isAddingSignal, setIsAddingSignal] = useState(false);
  const [customSignalLabel, setCustomSignalLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);
  const availableSignals = useMemo(() => [...builtInToiletSignals, ...customSignals], [customSignals]);
  const currentDuration = isEditingDuration
    ? (toDurationSeconds(durationMinutes, durationSecondPart) ?? durationSeconds)
    : durationSeconds;
  const hasRedFlag = bleeding || discomfort;
  const hasLongToilet = isLongToiletSession(currentDuration);
  const supplementalCount =
    Number(Boolean(stoolShape)) + Number(Boolean(stoolColor)) + signals.length + Number(discomfort) + Number(bleeding);
  const supplementalSummary = hasRedFlag
    ? `已补充 ${supplementalCount} 项 · 需要优先留意`
    : supplementalCount > 0
      ? `已补充 ${supplementalCount} 项，可随时再改`
      : '形状、颜色、小信号与需要留意';

  useEffect(() => {
    let active = true;

    async function loadSignalPresets() {
      try {
        const presets = await listToiletSignalPresets();
        if (active) setCustomSignals(presets);
      } catch (error) {
        if (active) setFormError(error instanceof Error ? error.message : '常用小信号加载失败');
      } finally {
        if (active) setIsLoadingSignals(false);
      }
    }

    void loadSignalPresets();
    return () => {
      active = false;
    };
  }, []);

  function toggleSignal(signal: ToiletSignal) {
    if (signals.some((item) => item.id === signal.id)) {
      setSignals((current) => current.filter((item) => item.id !== signal.id));
      return;
    }

    if (signals.length >= MAX_TOILET_SIGNALS_PER_SESSION) {
      setFormError(`一次最多选择 ${MAX_TOILET_SIGNALS_PER_SESSION} 个小信号`);
      return;
    }

    setFormError(null);
    setSignals((current) => [...current, signal]);
  }

  async function addCustomSignal() {
    const label = normalizeToiletSignalLabel(customSignalLabel);
    if (!label) {
      setFormError('请输入自定义小信号');
      return;
    }

    try {
      const preset = await createToiletSignalPreset(label);
      setCustomSignals((current) => {
        const withoutPreset = current.filter((item) => item.id !== preset.id);
        return [preset, ...withoutPreset];
      });
      setCustomSignalLabel('');
      setIsAddingSignal(false);
      setFormError(null);
      toggleSignal(preset);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '自定义小信号保存失败');
    }
  }

  function confirmDeleteCustomSignal(signal: ToiletSignalPreset) {
    Alert.alert('移除常用项？', `“${signal.label}”将不再出现在快捷选择中，已有历史记录不会改变。`, [
      { style: 'cancel', text: '保留' },
      {
        onPress: () => {
          void removeCustomSignal(signal);
        },
        style: 'destructive',
        text: '移除',
      },
    ]);
  }

  async function removeCustomSignal(signal: ToiletSignalPreset) {
    try {
      await deleteToiletSignalPreset(signal.id);
      setCustomSignals((current) => current.filter((item) => item.id !== signal.id));
      setSignals((current) => current.filter((item) => item.id !== signal.id));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '常用小信号移除失败');
    }
  }

  async function submit() {
    const nextDuration = isEditingDuration ? toDurationSeconds(durationMinutes, durationSecondPart) : durationSeconds;
    if (!nextDuration) {
      setFormError('时长请填写为大于 0 的分钟和秒数');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await onSubmit({
        bleeding,
        discomfort,
        durationSeconds: nextDuration,
        feeling,
        signals,
        stoolColor,
        stoolShape,
      });
      setDurationSeconds(nextDuration);
      setIsEditingDuration(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '记录保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.groupTitle}>本次时长</Text>
      <AppCard muted style={styles.durationCard}>
        <View>
          <Text style={styles.durationValue}>{formatToiletDuration(currentDuration)}</Text>
          <Text style={styles.durationCaption}>{isEditingDuration ? '可修改分钟和秒数' : '已由计时器自动带入'}</Text>
        </View>
        <Pressable
          accessibilityLabel={isEditingDuration ? '收起时长修改' : '修改时长'}
          accessibilityRole="button"
          onPress={() => setIsEditingDuration((current) => !current)}
          style={({ pressed }) => [styles.durationEditButton, pressed ? styles.pressed : null]}
        >
          <Pencil color={colors.primaryPressed} size={16} strokeWidth={2.5} />
          <Text style={styles.durationEditText}>{isEditingDuration ? '收起' : '修改'}</Text>
        </Pressable>
      </AppCard>

      {isEditingDuration ? (
        <View style={styles.durationInputs}>
          <DurationInput label="分钟" onChangeText={setDurationMinutes} value={durationMinutes} />
          <DurationInput label="秒" onChangeText={setDurationSecondPart} value={durationSecondPart} />
        </View>
      ) : null}

      <Text style={styles.groupTitle}>这趟感觉</Text>
      <View style={styles.feelingGrid}>
        {feelingOptions.map((option) => (
          <QuickFeelingChoice
            description={option.description}
            icon={option.icon}
            key={option.feeling}
            onPress={() => setFeeling(option.feeling)}
            selected={feeling === option.feeling}
            title={option.title}
          />
        ))}
      </View>

      <Pressable
        accessibilityHint="填写形状、颜色、小信号或需要优先留意的情况"
        accessibilityLabel="补充记录，可选"
        accessibilityRole="button"
        accessibilityState={{ expanded: isDetailSheetVisible }}
        onPress={() => setIsDetailSheetVisible(true)}
        style={({ pressed }) => [
          styles.supplementCard,
          hasRedFlag ? styles.supplementCardDanger : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={[styles.supplementIcon, hasRedFlag ? styles.supplementIconDanger : null]}>
          {hasRedFlag ? (
            <AlertTriangle color={colors.danger} size={19} strokeWidth={2.5} />
          ) : (
            <Plus color={colors.primaryPressed} size={20} strokeWidth={2.5} />
          )}
        </View>
        <View style={styles.supplementCopy}>
          <Text style={[styles.supplementTitle, hasRedFlag ? styles.supplementTitleDanger : null]}>
            补充记录（可选）
          </Text>
          <Text numberOfLines={1} style={styles.supplementCaption}>
            {supplementalSummary}
          </Text>
        </View>
        <Text style={[styles.supplementAction, hasRedFlag ? styles.supplementActionDanger : null]}>填写</Text>
      </Pressable>

      {formError ? (
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {formError}
        </Text>
      ) : null}
      <AppButton disabled={isSaving} onPress={() => void submit()}>
        {isSaving ? '保存中…' : submitLabel}
      </AppButton>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsDetailSheetVisible(false)}
        transparent
        visible={isDetailSheetVisible}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            accessibilityLabel="关闭补充记录"
            accessibilityRole="button"
            onPress={() => setIsDetailSheetVisible(false)}
            style={styles.sheetBackdrop}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>补充记录</Text>
                <Text style={styles.sheetCaption}>只记录你想记住的细节。</Text>
              </View>
              <Pressable
                accessibilityLabel="完成补充记录"
                accessibilityRole="button"
                onPress={() => setIsDetailSheetVisible(false)}
                style={({ pressed }) => [styles.sheetCloseButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.sheetCloseText}>完成</Text>
              </Pressable>
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}
            >
              <Text style={styles.sheetSectionTitle}>排便详情（可选）</Text>
              <AppCard style={styles.detailCard}>
                <OptionalChoiceRow
                  label="形状"
                  onChange={setStoolShape}
                  options={toiletStoolShapeOptions}
                  value={stoolShape}
                />
                <View style={styles.detailDivider} />
                <OptionalChoiceRow
                  label="颜色"
                  onChange={setStoolColor}
                  options={toiletStoolColorOptions}
                  value={stoolColor}
                />
              </AppCard>

              <View style={styles.signalHeader}>
                <View style={styles.signalHeaderCopy}>
                  <Text style={styles.sheetSectionTitle}>需要留意的小信号（可选）</Text>
                  <Text style={styles.signalCaption}>仅帮你记住当下，不作健康判断。</Text>
                </View>
                {customSignals.length > 0 ? (
                  <Pressable
                    accessibilityLabel="管理常用小信号"
                    accessibilityRole="button"
                    onPress={() => setIsManagingSignals((current) => !current)}
                    style={({ pressed }) => [styles.manageButton, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.manageButtonText}>{isManagingSignals ? '完成' : '管理常用'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.signalGrid}>
                {availableSignals.map((signal) => (
                  <SignalChip
                    key={signal.id}
                    label={signal.label}
                    onPress={() => toggleSignal(signal)}
                    selected={signals.some((item) => item.id === signal.id)}
                  />
                ))}
                <Pressable
                  accessibilityLabel="自定义小信号"
                  accessibilityRole="button"
                  onPress={() => setIsAddingSignal((current) => !current)}
                  style={({ pressed }) => [styles.addSignalChip, pressed ? styles.pressed : null]}
                >
                  <Plus color={colors.primaryPressed} size={16} strokeWidth={2.5} />
                  <Text style={styles.addSignalText}>自定义</Text>
                </Pressable>
              </View>
              {isLoadingSignals ? <Text style={styles.helperText}>正在准备常用项…</Text> : null}

              {isAddingSignal ? (
                <View style={styles.customSignalEditor}>
                  <TextInput
                    accessibilityLabel="自定义小信号名称"
                    autoFocus
                    maxLength={12}
                    onChangeText={setCustomSignalLabel}
                    placeholder="例如：饮食变化"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.customSignalInput}
                    value={customSignalLabel}
                  />
                  <Pressable
                    accessibilityLabel="添加并选中自定义小信号"
                    accessibilityRole="button"
                    onPress={() => void addCustomSignal()}
                    style={({ pressed }) => [styles.customSignalAddButton, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.customSignalAddText}>添加并选中</Text>
                  </Pressable>
                </View>
              ) : null}

              {isManagingSignals ? (
                <View style={styles.customSignalList}>
                  {customSignals.map((signal) => (
                    <View key={signal.id} style={styles.customSignalRow}>
                      <Text style={styles.customSignalRowText}>{signal.label}</Text>
                      <Pressable
                        accessibilityLabel={`移除常用小信号 ${signal.label}`}
                        accessibilityRole="button"
                        onPress={() => confirmDeleteCustomSignal(signal)}
                        style={({ pressed }) => [styles.removeSignalButton, pressed ? styles.pressed : null]}
                      >
                        <Trash2 color={colors.danger} size={16} strokeWidth={2.4} />
                        <Text style={styles.removeSignalText}>移除</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.sheetSectionTitle}>需要优先留意</Text>
              <View style={styles.priorityGrid}>
                <PrioritySignalChoice
                  description="不舒服就先让小花休息。"
                  onPress={() => setDiscomfort((current) => !current)}
                  selected={discomfort}
                  title="明显不舒服"
                />
                <PrioritySignalChoice
                  description="这类信号建议问医生。"
                  onPress={() => setBleeding((current) => !current)}
                  selected={bleeding}
                  title="明显便血"
                />
              </View>

              {hasRedFlag ? (
                <SafetyCard
                  buttonLabel="查看安全说明"
                  onOpenSafety={onOpenSafety}
                  text="这类信号别靠意志力硬扛。小提督不能判断病因，建议尽快咨询肛肠科、消化科或专业医生。"
                  tone="danger"
                />
              ) : hasLongToilet ? (
                <SafetyCard
                  buttonLabel="看看怎么少开长会"
                  onOpenSafety={onOpenSafety}
                  text="这趟坐得有点久。先收工，手机小剧场下次再播。"
                  tone="warning"
                />
              ) : null}

              {formError ? (
                <Text accessibilityLiveRegion="polite" style={styles.formError}>
                  {formError}
                </Text>
              ) : null}
            </ScrollView>
            <View style={styles.sheetFooter}>
              <AppButton onPress={() => setIsDetailSheetVisible(false)}>完成补充</AppButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuickFeelingChoice({
  description,
  icon: Icon,
  onPress,
  selected,
  title,
}: {
  description: string;
  icon: typeof Smile;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.feelingChoice,
        selected ? styles.feelingChoiceSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon color={selected ? colors.primaryPressed : colors.textMuted} size={22} strokeWidth={2.3} />
      <Text style={[styles.feelingChoiceText, selected ? styles.feelingChoiceTextSelected : null]}>{title}</Text>
    </Pressable>
  );
}

function PrioritySignalChoice({
  description,
  onPress,
  selected,
  title,
}: {
  description: string;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.priorityChoice,
        selected ? styles.priorityChoiceSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <AlertTriangle color={selected ? colors.danger : colors.textMuted} size={19} strokeWidth={2.4} />
      <Text style={[styles.priorityChoiceTitle, selected ? styles.priorityChoiceTitleSelected : null]}>{title}</Text>
      <Text style={styles.priorityChoiceCaption}>{description}</Text>
    </Pressable>
  );
}

function DurationInput({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.durationInputWrap}>
      <TextInput
        accessibilityLabel={`${label}数`}
        keyboardType="number-pad"
        onChangeText={onChangeText}
        style={styles.durationInput}
        value={value}
      />
      <Text style={styles.durationInputLabel}>{label}</Text>
    </View>
  );
}

function OptionalChoiceRow<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T | null) => void;
  options: Array<{ label: string; value: T }>;
  value: T | null;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              accessibilityLabel={`${label}${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onChange(selected ? null : option.value)}
              style={({ pressed }) => [
                styles.choiceChip,
                selected ? styles.choiceChipSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SignalChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.signalChip,
        selected ? styles.signalChipSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.signalChipText, selected ? styles.signalChipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function SafetyCard({
  buttonLabel,
  onOpenSafety,
  text,
  tone,
}: {
  buttonLabel: string;
  onOpenSafety?: () => void;
  text: string;
  tone: 'danger' | 'warning';
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const color = tone === 'danger' ? colors.danger : colors.warning;

  return (
    <AppCard style={[styles.safetyCard, tone === 'danger' ? styles.safetyCardDanger : styles.safetyCardWarning]}>
      <View style={styles.safetyHeader}>
        <AlertTriangle color={color} size={22} strokeWidth={2.4} />
        <Text style={styles.safetyText}>{text}</Text>
      </View>
      {onOpenSafety ? (
        <AppButton onPress={onOpenSafety} variant={tone === 'danger' ? 'secondary' : 'warning'}>
          {buttonLabel}
        </AppButton>
      ) : null}
    </AppCard>
  );
}

function toDurationSeconds(minutesText: string, secondsText: string): number | null {
  if (!/^\d+$/.test(minutesText) || !/^\d+$/.test(secondsText)) return null;

  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (!Number.isSafeInteger(minutes) || !Number.isSafeInteger(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return null;
  }

  const duration = minutes * 60 + seconds;
  return Number.isSafeInteger(duration) && duration > 0 ? duration : null;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    addSignalChip: {
      alignItems: 'center',
      borderColor: colors.primary,
      borderRadius: 16,
      borderStyle: 'dashed',
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 42,
      paddingHorizontal: 12,
    },
    addSignalText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
      marginLeft: 4,
    },
    choiceChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 15,
      borderWidth: 1,
      flexGrow: 1,
      minHeight: 42,
      paddingHorizontal: 10,
      justifyContent: 'center',
    },
    choiceChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    choiceChipText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    choiceChipTextSelected: {
      color: colors.primaryPressed,
    },
    choiceGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    choiceLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    customSignalAddButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
    },
    customSignalAddText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
    },
    customSignalEditor: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    customSignalInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      minHeight: 44,
      paddingHorizontal: 12,
    },
    customSignalList: {
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      marginBottom: 18,
      overflow: 'hidden',
    },
    customSignalRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      flexDirection: 'row',
      minHeight: 48,
      paddingHorizontal: 14,
    },
    customSignalRowText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
    },
    detailCard: {
      marginBottom: 18,
      padding: 16,
    },
    detailDivider: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 16,
    },
    durationCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },
    durationCard: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    durationEditButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 15,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 38,
      paddingHorizontal: 11,
    },
    durationEditText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
      marginLeft: 4,
    },
    durationInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      height: 48,
      paddingHorizontal: 12,
      textAlign: 'center',
    },
    durationInputLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 5,
      textAlign: 'center',
    },
    durationInputWrap: {
      flex: 1,
    },
    durationInputs: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 18,
    },
    durationValue: {
      color: colors.text,
      fontSize: 24,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
    },
    feelingChoice: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      gap: 7,
      justifyContent: 'center',
      minHeight: 78,
      paddingHorizontal: 6,
    },
    feelingChoiceSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    feelingChoiceText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    feelingChoiceTextSelected: {
      color: colors.primaryPressed,
    },
    feelingGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    formError: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      marginBottom: 12,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
    },
    helperText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 16,
    },
    manageButton: {
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    manageButtonText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
    },
    pressed: {
      opacity: 0.78,
      transform: [{ scale: 0.98 }],
    },
    priorityChoice: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      minHeight: 108,
      padding: 13,
    },
    priorityChoiceCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      marginTop: 5,
    },
    priorityChoiceSelected: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
    },
    priorityChoiceTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 10,
    },
    priorityChoiceTitleSelected: {
      color: colors.danger,
    },
    priorityGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
    },
    removeSignalButton: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 36,
      paddingHorizontal: 4,
    },
    removeSignalText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '800',
      marginLeft: 4,
    },
    safetyCard: {
      marginBottom: 18,
    },
    safetyCardDanger: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
    },
    safetyCardWarning: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    safetyHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginBottom: 14,
    },
    safetyText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
    signalCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 3,
    },
    signalChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 12,
    },
    signalChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    signalChipText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    signalChipTextSelected: {
      color: colors.primaryPressed,
    },
    signalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    signalHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    signalHeaderCopy: {
      flex: 1,
      paddingRight: 12,
    },
    sheet: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      maxHeight: '88%',
      overflow: 'hidden',
    },
    sheetBackdrop: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    sheetCaption: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    sheetCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 11,
    },
    sheetCloseText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
    },
    sheetContent: {
      paddingBottom: 8,
      paddingHorizontal: 24,
    },
    sheetFooter: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingBottom: 26,
      paddingHorizontal: 24,
      paddingTop: 14,
    },
    sheetHandle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 99,
      height: 4,
      marginBottom: 12,
      marginTop: 10,
      width: 38,
    },
    sheetHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 16,
      paddingHorizontal: 24,
    },
    sheetRoot: {
      backgroundColor: 'rgba(15, 23, 19, 0.38)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheetSectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 10,
    },
    sheetScroll: {
      flexShrink: 1,
    },
    sheetTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    supplementAction: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
      marginLeft: 8,
    },
    supplementActionDanger: {
      color: colors.danger,
    },
    supplementCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    supplementCard: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 14,
      minHeight: 72,
      paddingHorizontal: 14,
    },
    supplementCardDanger: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
    },
    supplementCopy: {
      flex: 1,
      minWidth: 0,
    },
    supplementIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 15,
      height: 38,
      justifyContent: 'center',
      marginRight: 11,
      width: 38,
    },
    supplementIconDanger: {
      backgroundColor: colors.surface,
    },
    supplementTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    supplementTitleDanger: {
      color: colors.danger,
    },
    root: {
      paddingBottom: 4,
    },
  });
}
