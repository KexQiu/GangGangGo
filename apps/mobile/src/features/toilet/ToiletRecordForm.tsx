import { AlertTriangle, CircleDot, Frown, Pencil, Plus, Smile, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppSheet } from '../../components/AppSheet';
import {
  createToiletSignalPreset,
  deleteToiletSignalPreset,
  listToiletSignalPresets,
} from '../../storage/repositories/toiletRepository';
import { useAppTheme } from '../../theme/themeProvider';
import {
  DurationPickerSheet,
  OptionalChoiceRow,
  PrioritySignalChoice,
  QuickFeelingChoice,
  SafetyCard,
  SignalChip,
} from './components/ToiletRecordFormFields';
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
import { createToiletRecordFormStyles } from './styles/toiletRecordFormStyles';

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
  const styles = createToiletRecordFormStyles(colors);
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
