import type { ComponentType } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Clock3, Minus, Plus, Trash2 } from 'lucide-react-native';

import { formatRange, getRangeTitle } from '../reminderPresentation';
import type { QuietHoursRange } from '../reminderTypes';
import { useAppTheme } from '../../../theme/themeProvider';
import { createReminderSectionStyles } from '../styles/reminderSectionStyles';

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type SettingHeaderProps = {
  description: string;
  icon: ComponentType<IconProps>;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
};

export function SettingHeader({ description, icon: Icon, onValueChange, title, value }: SettingHeaderProps) {
  const { colors } = useAppTheme();
  const styles = createReminderSectionStyles(colors);

  return (
    <View style={styles.settingHeader}>
      <View style={styles.settingIcon}>
        <Icon color={value ? colors.primaryPressed : colors.textMuted} size={21} strokeWidth={2.4} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        ios_backgroundColor={colors.surfaceMuted}
        onValueChange={onValueChange}
        thumbColor={value ? colors.primary : colors.textSubtle}
        trackColor={{ false: colors.surfaceMuted, true: colors.primarySoft }}
        value={value}
      />
    </View>
  );
}

type SegmentOptionProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
};

export function SegmentOption({ label, onPress, selected }: SegmentOptionProps) {
  const { colors } = useAppTheme();
  const styles = createReminderSectionStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type QuietRangeEditorProps = {
  index: number;
  onMove: (field: 'end' | 'start', deltaMinutes: number) => void;
  onRemove: () => void;
  range: QuietHoursRange;
};

export function QuietRangeEditor({ index, onMove, onRemove, range }: QuietRangeEditorProps) {
  const { colors } = useAppTheme();
  const styles = createReminderSectionStyles(colors);

  return (
    <View style={styles.rangeEditor}>
      <View style={styles.rangeEditorHeader}>
        <View style={styles.rangeTitleRow}>
          <View style={styles.rangeTitleIcon}>
            <Clock3 color={colors.primaryPressed} size={17} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.rangeTitle}>{getRangeTitle(range, index)}</Text>
            <Text style={styles.rangeSubTitle}>{formatRange(range)}</Text>
          </View>
        </View>
        <Pressable
          onPress={onRemove}
          accessibilityLabel={`删除${getRangeTitle(range, index)}`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.removeRangeButton, pressed && styles.pressed]}
        >
          <Trash2 color={colors.textMuted} size={17} strokeWidth={2.3} />
        </Pressable>
      </View>

      <View style={styles.timeRows}>
        <TimeAdjustRow
          label="开始"
          onDecrease={() => {
            onMove('start', -15);
          }}
          onIncrease={() => {
            onMove('start', 15);
          }}
          value={range.start}
        />
        <TimeAdjustRow
          label="结束"
          onDecrease={() => {
            onMove('end', -15);
          }}
          onIncrease={() => {
            onMove('end', 15);
          }}
          value={range.end}
        />
      </View>
    </View>
  );
}

type TimeAdjustRowProps = {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: string;
};

function TimeAdjustRow({ label, onDecrease, onIncrease, value }: TimeAdjustRowProps) {
  const { colors } = useAppTheme();
  const styles = createReminderSectionStyles(colors);

  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeRowLabel}>{label}</Text>
      <View style={styles.timeStepper}>
        <Pressable
          onPress={onDecrease}
          accessibilityLabel={`${label}时间提前 15 分钟`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
        >
          <Minus color={colors.textMuted} size={15} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.timeValue}>{value}</Text>
        <Pressable
          onPress={onIncrease}
          accessibilityLabel={`${label}时间推后 15 分钟`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
        >
          <Plus color={colors.textMuted} size={15} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}
