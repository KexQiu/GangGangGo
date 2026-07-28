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
  useWindowDimensions,
} from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

const sheetAnimationDuration = 280;
const dialogAnimationDuration = 180;

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
  const [isPanelReady, setIsPanelReady] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const isPresentedRef = useRef(visible);
  const isPanelReadyRef = useRef(false);
  const visibleRef = useRef(visible);
  const cachedChildren = useRef<ReactNode>(children);
  const transitionProgress = useRef(new Animated.Value(0)).current;

  visibleRef.current = visible;
  if (visible) cachedChildren.current = children;

  useEffect(() => {
    let frame: number | null = null;
    let transition: Animated.CompositeAnimation | null = null;
    const target = visible ? 1 : 0;
    const duration = presentation === 'sheet' ? sheetAnimationDuration : dialogAnimationDuration;

    if (visible) {
      if (!isPresentedRef.current) {
        isPresentedRef.current = true;
        isPanelReadyRef.current = false;
        setIsPanelReady(false);
        setIsPresented(true);
        return;
      }
      if (!isPanelReady) return;
      // Wait for Modal to mount so its first painted frame matches the animation start.
      frame = requestAnimationFrame(() => {
        transitionProgress.stopAnimation((currentValue) => {
          const distance = Math.abs(target - currentValue);
          transition = Animated.timing(transitionProgress, {
            duration: Math.max(90, Math.round(duration * distance)),
            easing: Easing.out(Easing.cubic),
            toValue: target,
            useNativeDriver: true,
          });
          transition.start();
        });
      });
    } else if (isPresentedRef.current) {
      transitionProgress.stopAnimation((currentValue) => {
        const distance = Math.abs(target - currentValue);
        transition = Animated.timing(transitionProgress, {
          duration: Math.max(80, Math.round(duration * distance)),
          easing: Easing.in(Easing.cubic),
          toValue: target,
          useNativeDriver: true,
        });
        transition.start(({ finished }) => {
          if (finished && !visibleRef.current) {
            isPresentedRef.current = false;
            isPanelReadyRef.current = false;
            setIsPanelReady(false);
            setIsPresented(false);
          }
        });
      });
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      transition?.stop();
    };
  }, [isPanelReady, presentation, transitionProgress, visible]);

  const content = visible ? children : cachedChildren.current;
  const hiddenTranslateY = presentation === 'sheet' ? windowHeight : 16;
  const panelOpacity = presentation === 'dialog' ? transitionProgress : 1;
  const panelTranslateY = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [hiddenTranslateY, 0],
  });
  const panelStyle = [
    styles.panel,
    presentation === 'sheet' ? styles.sheet : styles.dialog,
    maxHeight === undefined ? null : { maxHeight },
  ];

  return (
    <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent transparent visible={isPresented}>
      <View style={[styles.root, presentation === 'dialog' ? styles.dialogRoot : null]}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: transitionProgress }]} />
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdropPressTarget}
        />
        <Animated.View
          onLayout={() => {
            if (isPanelReadyRef.current) return;

            isPanelReadyRef.current = true;
            setIsPanelReady(true);
          }}
          style={[panelStyle, { opacity: panelOpacity, transform: [{ translateY: panelTranslateY }] }]}
        >
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
    backdropPressTarget: StyleSheet.absoluteFillObject,
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
