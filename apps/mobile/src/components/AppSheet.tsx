import { X } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

const sheetEnterTranslateY = 64;

type AppSheetPresentation = 'dialog' | 'sheet';

type AppSheetProps = {
  accessibilityLabel: string;
  children: ReactNode;
  closeLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  footer?: ReactNode;
  maxHeight?: DimensionValue;
  onClose: () => void;
  presentation?: AppSheetPresentation;
  scroll?: boolean;
  subtitle?: string;
  title: string;
  visible: boolean;
};

/**
 * 应用内统一的模态容器。
 *
 * 负责遮罩、进出动画、标题区、关闭行为和固定页脚；业务页面只提供内容。
 */
export function AppSheet({
  accessibilityLabel,
  children,
  closeLabel = '关闭',
  contentContainerStyle,
  eyebrow,
  footer,
  maxHeight,
  onClose,
  presentation = 'sheet',
  scroll = true,
  subtitle,
  title,
  visible,
}: AppSheetProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [isPresented, setIsPresented] = useState(visible);
  const cachedChildren = useRef<ReactNode>(children);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(sheetEnterTranslateY)).current;

  if (visible) cachedChildren.current = children;

  useEffect(() => {
    if (visible) {
      setIsPresented(true);
      return;
    }

    if (!isPresented) return;

    const closingAnimation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: 150,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        duration: 160,
        easing: Easing.in(Easing.cubic),
        toValue: presentation === 'sheet' ? sheetEnterTranslateY : 12,
        useNativeDriver: true,
      }),
    ]);

    closingAnimation.start(({ finished }) => {
      if (finished) setIsPresented(false);
    });

    return () => closingAnimation.stop();
  }, [backdropOpacity, isPresented, presentation, sheetTranslateY, visible]);

  useEffect(() => {
    if (!visible || !isPresented) return;

    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(presentation === 'sheet' ? sheetEnterTranslateY : 12);
    const openingAnimation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: 170,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        damping: 22,
        mass: 0.8,
        stiffness: 250,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);
    const frame = requestAnimationFrame(() => openingAnimation.start());

    return () => {
      cancelAnimationFrame(frame);
      openingAnimation.stop();
    };
  }, [backdropOpacity, isPresented, presentation, sheetTranslateY, visible]);

  const content = visible ? children : cachedChildren.current;
  const panelStyle = [
    styles.panel,
    presentation === 'sheet' ? styles.sheet : styles.dialog,
    maxHeight === undefined ? null : { maxHeight },
  ];

  return (
    <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent transparent visible={isPresented}>
      <View style={[styles.root, presentation === 'dialog' ? styles.dialogRoot : null]}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <Animated.View style={[panelStyle, { transform: [{ translateY: sheetTranslateY }] }]}>
          {presentation === 'sheet' ? <View style={styles.handle} /> : null}
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable
              accessibilityLabel={closeLabel}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeButton}
            >
              <X color={colors.textMuted} size={17} strokeWidth={2.5} />
              <Text style={styles.closeText}>{closeLabel}</Text>
            </Pressable>
          </View>

          {scroll ? (
            <ScrollView
              bounces={false}
              contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              {content}
            </ScrollView>
          ) : (
            <View style={[styles.staticContent, contentContainerStyle]}>{content}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12, 21, 16, 0.48)' },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 3,
      minHeight: 36,
      paddingHorizontal: 10,
    },
    closeText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
    dialog: { borderRadius: 24, maxHeight: '82%', maxWidth: 360, width: '100%' },
    dialogRoot: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    eyebrow: { color: colors.privacy, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    footer: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    handle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 99,
      height: 4,
      marginBottom: 12,
      marginTop: 10,
      width: 40,
    },
    header: { alignItems: 'flex-start', flexDirection: 'row', gap: 14, paddingBottom: 16, paddingHorizontal: 20 },
    headerCopy: { flex: 1, gap: 3 },
    panel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    root: { flex: 1, justifyContent: 'flex-end' },
    scroll: { flexShrink: 1 },
    scrollContent: { gap: 14, paddingBottom: 32, paddingHorizontal: 20 },
    sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '86%', width: '100%' },
    staticContent: { gap: 14, paddingBottom: 20, paddingHorizontal: 20 },
    subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', lineHeight: 19 },
    title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  });
}
