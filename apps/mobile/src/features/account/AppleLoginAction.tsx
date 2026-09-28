import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { showToast } from '../../components/toast/AppToast';
import { useAppTheme } from '../../theme/themeProvider';
import { trackGrowthEvent } from '../growth/growthEventTracker';
import { isAppleSignInAvailable, signInWithApple } from './appleSignIn';
import { useAuthStore } from './authStore';

export function AppleLoginAction({
  source,
  active,
  onSuccess,
}: {
  source: 'settings' | 'friend';
  active: boolean;
  onSuccess: () => void;
}) {
  const { colors, resolvedScheme } = useAppTheme();
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable' | 'error'>('checking');
  const [pending, setPending] = useState(false);
  const authLoading = useAuthStore((state) => state.isLoading);
  const mounted = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const styles = StyleSheet.create({
    button: { width: '100%', height: 54 },
    container: { gap: 8 },
    message: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  });

  async function checkAvailability() {
    setAvailability('checking');
    try {
      const available = await isAppleSignInAvailable();
      if (mounted.current) setAvailability(available ? 'available' : 'unavailable');
    } catch {
      if (mounted.current) setAvailability('error');
    }
  }

  useEffect(() => {
    mounted.current = true;
    void checkAvailability();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function login() {
    if (pending || authLoading || !activeRef.current) return;
    setPending(true);
    try {
      const result = await signInWithApple(() => mounted.current && activeRef.current);
      if (result === 'signed_in') {
        trackGrowthEvent('login_completed', { source });
        if (mounted.current) onSuccess();
      } else if (result === 'unavailable' && mounted.current) {
        setAvailability('unavailable');
      }
    } catch {
      if (mounted.current && activeRef.current) showToast('Apple 登录暂时未完成，请稍后重试。', { type: 'error' });
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  if (availability === 'checking')
    return <ActivityIndicator accessibilityLabel="检查 Apple 登录" color={colors.textMuted} />;
  if (availability === 'unavailable')
    return <Text style={styles.message}>此设备暂不支持 Apple 登录，可继续使用本地记录。</Text>;
  if (availability === 'error')
    return (
      <AppButton onPress={() => void checkAvailability()} variant="secondary">
        重试检查 Apple 登录
      </AppButton>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.message}>继续即按上述范围登录并同步。</Text>
      <View
        pointerEvents={pending || authLoading ? 'none' : 'auto'}
        accessibilityState={{ busy: pending || authLoading }}
      >
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            resolvedScheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={18}
          style={styles.button}
          onPress={() => void login()}
        />
      </View>
      {pending || authLoading ? <ActivityIndicator accessibilityLabel="登录中" color={colors.textMuted} /> : null}
    </View>
  );
}
