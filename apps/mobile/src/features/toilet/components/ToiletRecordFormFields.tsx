import { AlertTriangle, Smile } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppSheet } from '../../../components/AppSheet';
import { useAppTheme } from '../../../theme/themeProvider';
import { DURATION_WHEEL_ROW_HEIGHT, durationSecondOptions } from '../toiletRecordForm.constants';
import { formatToiletDuration } from '../toiletLogic';
import { createToiletRecordFormStyles } from '../styles/toiletRecordFormStyles';

export function QuickFeelingChoice({
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
  const styles = createToiletRecordFormStyles(colors);

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

export function PrioritySignalChoice({
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
  const styles = createToiletRecordFormStyles(colors);

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

export function DurationPickerSheet({
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
  const styles = createToiletRecordFormStyles(colors);
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
  const styles = createToiletRecordFormStyles(colors);
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

export function OptionalChoiceRow<T extends string>({
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
  const styles = createToiletRecordFormStyles(colors);

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

export function SignalChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { colors } = useAppTheme();
  const styles = createToiletRecordFormStyles(colors);

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

export function SafetyCard({
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
  const styles = createToiletRecordFormStyles(colors);
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

function formatWheelValue(value: number): string {
  return value.toString().padStart(2, '0');
}
