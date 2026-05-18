import { type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useAppTheme } from '../theme/themeProvider';

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type OptionRowProps = {
  description?: string;
  icon?: ComponentType<IconProps>;
  onPress?: () => void;
  selected?: boolean;
  title: string;
};

export function OptionRow({ description, icon: Icon, onPress, selected = false, title }: OptionRowProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, selected);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {Icon ? (
        <View style={styles.iconBadge}>
          <Icon color={selected ? colors.primaryPressed : colors.textMuted} size={20} strokeWidth={2.3} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {selected ? <Check color={colors.primaryPressed} size={20} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors, selected: boolean) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      backgroundColor: selected ? colors.primarySoft : colors.surface,
      borderColor: selected ? colors.primary : colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 10,
      minHeight: 74,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    pressed: {
      opacity: 0.85,
    },
    iconBadge: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    textWrap: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: descriptionMargin(selected),
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },
  });
}

function descriptionMargin(selected: boolean) {
  return selected ? 4 : 5;
}
