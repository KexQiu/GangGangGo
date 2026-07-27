import { AlertTriangle, CircleDot, Frown, Pencil, Plus, Smile, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppSheet } from '../../components/AppSheet';
import { useAppTheme } from '../../theme/themeProvider';
import { isLongToiletSession, formatToiletDuration } from './toiletLogic';
import {
  builtInToiletSignals,
  MAX_TOILET_SIGNALS_PER_SESSION,
  normalizeToiletSignalLabel,
  toiletStoolColorOptions,
  toiletStoolShapeOptions,
  toSelectableToiletStoolColor,
} from './toiletRecordLogic';
import {
  type ToiletFeeling,
  type ToiletRecordDraft,
  type ToiletSignal,
  type ToiletSignalPreset,
  type ToiletStoolColorOption,
} from './toiletTypes';
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

const DURATION_WHEEL_ROW_HEIGHT = 48;
const DURATION_WHEEL_SIDE_ROWS = 2;
const durationSecondOptions = Array.from({ length: 60 }, (_, value) => value);

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
  const [isDurationPickerVisible, setIsDurationPickerVisible] = useState(false);
  const [isDurationManuallyEdited, setIsDurationManuallyEdited] = useState(false);
  const [durationPickerMinutes, setDurationPickerMinutes] = useState(() =>
    Math.floor(Math.max(1, initialValue.durationSeconds) / 60),
  );
  const [durationPickerSeconds, setDurationPickerSeconds] = useState(
    () => Math.max(1, initialValue.durationSeconds) % 60,
  );
  const [durationPickerError, setDurationPickerError] = useState<string | null>(null);
  const [feeling, setFeeling] = useState<ToiletFeeling>(initialValue.feeling);
  const [discomfort, setDiscomfort] = useState(initialValue.discomfort);
  const [bleeding, setBleeding] = useState(initialValue.bleeding);
  const [stoolShape, setStoolShape] = useState(initialValue.stoolShape ?? null);
  const [stoolColor, setStoolColor] = useState<ToiletStoolColorOption | null>(() =>
    toSelectableToiletStoolColor(initialValue.stoolColor),
  );
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
  const durationMinuteOptions = useMemo(() => createDurationMinuteOptions(durationSeconds), [durationSeconds]);
  const currentDuration = durationSeconds;
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

  function openDurationPicker() {
    const nextDuration = Math.max(1, durationSeconds);
    setDurationPickerMinutes(Math.floor(nextDuration / 60));
    setDurationPickerSeconds(nextDuration % 60);
    setDurationPickerError(null);
    setIsDurationPickerVisible(true);
  }

  function confirmDurationPicker(minutes: number, seconds: number) {
    const nextDuration = toDurationSeconds(minutes, seconds);
    if (!nextDuration) {
      setDurationPickerError('时长请至少设为 1 秒');
      return;
    }

    setDurationPickerMinutes(minutes);
    setDurationPickerSeconds(seconds);
    setDurationSeconds(nextDuration);
    setDurationPickerError(null);
    setIsDurationManuallyEdited(true);
    setIsDurationPickerVisible(false);
  }

  async function submit() {
    const nextDuration = durationSeconds;
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
          <Text style={styles.durationCaption}>{isDurationManuallyEdited ? '已手动调整' : '已由计时器自动带入'}</Text>
        </View>
        <Pressable
          accessibilityLabel="修改时长"
          accessibilityRole="button"
          onPress={openDurationPicker}
          style={({ pressed }) => [styles.durationEditButton, pressed ? styles.pressed : null]}
        >
          <Pencil color={colors.primaryPressed} size={16} strokeWidth={2.5} />
          <Text style={styles.durationEditText}>修改</Text>
        </Pressable>
      </AppCard>

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

      <DurationPickerSheet
        error={durationPickerError}
        minuteOptions={durationMinuteOptions}
        minutes={durationPickerMinutes}
        onClose={() => setIsDurationPickerVisible(false)}
        onConfirm={confirmDurationPicker}
        onMinutesChange={(value) => {
          setDurationPickerMinutes(value);
          setDurationPickerError(null);
        }}
        onSecondsChange={(value) => {
          setDurationPickerSeconds(value);
          setDurationPickerError(null);
        }}
        seconds={durationPickerSeconds}
        visible={isDurationPickerVisible}
      />

      <AppSheet
        accessibilityLabel="关闭补充记录"
        closeLabel="完成"
        contentContainerStyle={styles.sheetContent}
        footer={<AppButton onPress={() => setIsDetailSheetVisible(false)}>完成补充</AppButton>}
        maxHeight="88%"
        onClose={() => setIsDetailSheetVisible(false)}
        subtitle="只记录你想记住的细节。"
        title="补充记录"
        visible={isDetailSheetVisible}
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
      </AppSheet>
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

function DurationPickerSheet({
  error,
  minuteOptions,
  minutes,
  onClose,
  onConfirm,
  onMinutesChange,
  onSecondsChange,
  seconds,
  visible,
}: {
  error: string | null;
  minuteOptions: number[];
  minutes: number;
  onClose: () => void;
  onConfirm: (minutes: number, seconds: number) => void;
  onMinutesChange: (value: number) => void;
  onSecondsChange: (value: number) => void;
  seconds: number;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [previewMinutes, setPreviewMinutes] = useState(minutes);
  const [previewSeconds, setPreviewSeconds] = useState(seconds);

  useEffect(() => {
    if (!visible) return;

    setPreviewMinutes(minutes);
    setPreviewSeconds(seconds);
  }, [minutes, seconds, visible]);

  return (
    <AppSheet
      accessibilityLabel="取消修改时长"
      closeLabel="取消"
      contentContainerStyle={styles.durationSheetContent}
      footer={<AppButton onPress={() => onConfirm(previewMinutes, previewSeconds)}>确认时长</AppButton>}
      onClose={onClose}
      scroll={false}
      subtitle="滑动滚轮，确认后才会更新记录。"
      title="调整时长"
      visible={visible}
    >
      <View style={styles.durationPickerReadout}>
        <Text style={styles.durationPickerValue}>{formatToiletDuration(previewMinutes * 60 + previewSeconds)}</Text>
        <Text style={styles.durationPickerCaption}>分钟和秒数可分别调整</Text>
      </View>
      <View style={styles.durationWheelRow}>
        <DurationWheel
          label="分钟"
          onChange={onMinutesChange}
          onPreviewChange={setPreviewMinutes}
          options={minuteOptions}
          value={minutes}
          visible={visible}
        />
        <DurationWheel
          label="秒"
          onChange={onSecondsChange}
          onPreviewChange={setPreviewSeconds}
          options={durationSecondOptions}
          value={seconds}
          visible={visible}
        />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.durationPickerError}>
          {error}
        </Text>
      ) : null}
    </AppSheet>
  );
}

function DurationWheel({
  label,
  onChange,
  onPreviewChange,
  options,
  value,
  visible,
}: {
  label: string;
  onChange: (value: number) => void;
  onPreviewChange: (value: number) => void;
  options: number[];
  value: number;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const scrollRef = useRef<ScrollView>(null);
  const displayedValueRef = useRef(value);
  const [displayedValue, setDisplayedValue] = useState(value);
  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    if (!visible) return;

    displayedValueRef.current = value;
    setDisplayedValue(value);
    const animationFrame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ animated: false, y: selectedIndex * DURATION_WHEEL_ROW_HEIGHT });
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [selectedIndex, value, visible]);

  function getValueForOffset(offsetY: number): number {
    const nextIndex = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / DURATION_WHEEL_ROW_HEIGHT)));
    return options[nextIndex];
  }

  function updatePreview(offsetY: number) {
    const nextValue = getValueForOffset(offsetY);
    if (nextValue === displayedValueRef.current) return;

    displayedValueRef.current = nextValue;
    setDisplayedValue(nextValue);
    onPreviewChange(nextValue);
  }

  function settleValue(offsetY: number) {
    const nextValue = getValueForOffset(offsetY);
    updatePreview(offsetY);
    if (nextValue !== value) onChange(nextValue);
  }

  function adjustBy(amount: number) {
    const nextIndex = Math.min(options.length - 1, Math.max(0, selectedIndex + amount));
    const nextValue = options[nextIndex];
    displayedValueRef.current = nextValue;
    setDisplayedValue(nextValue);
    onPreviewChange(nextValue);
    onChange(nextValue);
  }

  return (
    <View style={styles.durationWheelColumn}>
      <Text style={styles.durationWheelLabel}>{label}</Text>
      <View
        accessibilityActions={[
          { label: `增加${label}`, name: 'increment' },
          { label: `减少${label}`, name: 'decrement' },
        ]}
        accessibilityLabel={`${label}滚轮，当前 ${formatWheelValue(displayedValue)} ${label}`}
        accessibilityRole="adjustable"
        accessibilityValue={{
          max: options.at(-1),
          min: options[0],
          now: displayedValue,
          text: `${formatWheelValue(displayedValue)} ${label}`,
        }}
        onAccessibilityAction={({ nativeEvent }) => adjustBy(nativeEvent.actionName === 'increment' ? 1 : -1)}
        style={styles.durationWheelViewport}
      >
        <View pointerEvents="none" style={styles.durationWheelSelection} />
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.durationWheelContent}
          decelerationRate="fast"
          onMomentumScrollEnd={({ nativeEvent }) => settleValue(nativeEvent.contentOffset.y)}
          onScroll={({ nativeEvent }) => updatePreview(nativeEvent.contentOffset.y)}
          onScrollEndDrag={({ nativeEvent }) => {
            if (Math.abs(nativeEvent.velocity?.y ?? 0) < 0.01) settleValue(nativeEvent.contentOffset.y);
          }}
          overScrollMode="never"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToAlignment="center"
          snapToInterval={DURATION_WHEEL_ROW_HEIGHT}
          ref={scrollRef}
        >
          {options.map((option) => (
            <View key={option} style={styles.durationWheelItem}>
              <Text
                style={[
                  styles.durationWheelValue,
                  option === displayedValue ? styles.durationWheelValueSelected : null,
                ]}
              >
                {formatWheelValue(option)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
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

function toDurationSeconds(minutes: number, seconds: number): number | null {
  if (!Number.isSafeInteger(minutes) || !Number.isSafeInteger(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return null;
  }

  const duration = minutes * 60 + seconds;
  return Number.isSafeInteger(duration) && duration > 0 ? duration : null;
}

function createDurationMinuteOptions(durationSeconds: number): number[] {
  const currentMinutes = Math.floor(Math.max(0, durationSeconds) / 60);
  const maximumMinutes = Math.max(180, currentMinutes + 30);
  return Array.from({ length: maximumMinutes + 1 }, (_, value) => value);
}

function formatWheelValue(value: number): string {
  return value.toString().padStart(2, '0');
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
    durationPickerCaption: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    durationPickerError: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      marginHorizontal: 24,
      marginTop: 12,
      textAlign: 'center',
    },
    durationPickerReadout: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      marginHorizontal: 24,
      paddingVertical: 14,
    },
    durationSheetContent: {
      gap: 0,
      paddingHorizontal: 0,
    },
    durationPickerValue: {
      color: colors.primaryPressed,
      fontSize: 28,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
    },
    durationWheelColumn: {
      flex: 1,
    },
    durationWheelContent: {
      paddingVertical: DURATION_WHEEL_ROW_HEIGHT * DURATION_WHEEL_SIDE_ROWS,
    },
    durationWheelItem: {
      alignItems: 'center',
      height: DURATION_WHEEL_ROW_HEIGHT,
      justifyContent: 'center',
    },
    durationWheelLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    durationWheelRow: {
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 24,
      paddingTop: 20,
    },
    durationWheelSelection: {
      borderBottomColor: colors.primary,
      borderBottomWidth: 1,
      borderTopColor: colors.primary,
      borderTopWidth: 1,
      height: DURATION_WHEEL_ROW_HEIGHT,
      left: 0,
      position: 'absolute',
      right: 0,
      top: DURATION_WHEEL_ROW_HEIGHT * DURATION_WHEEL_SIDE_ROWS,
      zIndex: 1,
    },
    durationWheelValue: {
      color: colors.textSubtle,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    durationWheelValueSelected: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    durationWheelViewport: {
      height: DURATION_WHEEL_ROW_HEIGHT * (DURATION_WHEEL_SIDE_ROWS * 2 + 1),
      overflow: 'hidden',
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
    sheetContent: {
      gap: 0,
      paddingBottom: 8,
      paddingHorizontal: 24,
    },
    sheetSectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 10,
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
