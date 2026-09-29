import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { AppCard } from '../../../src/components/AppCard';
import { AppButton } from '../../../src/components/AppButton';
import { authSessionContext } from '../../../src/api/sessionContext';
import { useAuthStore } from '../../../src/features/account/authStore';
import { AppTopBar } from '../../../src/components/AppTopBar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Screen } from '../../../src/components/Screen';
import { ToiletRecordForm } from '../../../src/features/toilet/ToiletRecordForm';
import { createToiletRecordDraft } from '../../../src/features/toilet/toiletRecordLogic';
import { useToiletStore } from '../../../src/features/toilet/toiletStore';
import { type ToiletSession } from '../../../src/features/toilet/toiletTypes';
import { getToiletSession } from '../../../src/storage/repositories/toiletRepository';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

export default function ToiletRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const recordId = typeof params.id === 'string' ? params.id : '';
  const updateSession = useToiletStore((state) => state.updateSession);
  const deleteSession = useToiletStore((state) => state.deleteSession);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [loaded, setLoaded] = useState<{ record: ToiletSession; generation: number } | null>(null);
  const session = loaded?.record ?? null;
  const token = useAuthStore((state) => state.accessToken);
  const authLoading = useAuthStore((state) => state.isLoading || !state.hasHydrated);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const focused = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      focused.current = true;
      setIsLoading(true);
      setLoaded(null);
      setError(null);

      const load = async () => {
        const generation = authSessionContext.captureLocalGeneration();
        const record = await getToiletSession(recordId);
        authSessionContext.assertGeneration(generation);
        return record ? { record, generation } : null;
      };
      if (!authLoading)
        void load()
          .then((record) => {
            if (active) setLoaded(record);
          })
          .catch((reason) => {
            if (active) setError(reason instanceof Error ? reason.message : '记录加载失败');
          })
          .finally(() => {
            if (active) setIsLoading(false);
          });

      return () => {
        active = false;
        focused.current = false;
      };
      // 凭证变化与手动重试必须重新读取当前资料，即使查询不直接使用 token。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recordId, token, authLoading, retry]),
  );

  async function saveSession(draft: ReturnType<typeof createToiletRecordDraft>) {
    if (!loaded || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await updateSession({ ...loaded.record, ...draft }, { generation: loaded.generation });
      authSessionContext.assertGeneration(loaded.generation);
      if (focused.current) router.back();
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!session || operation.current) return;
    Alert.alert('删除本次记录？', '删除后无法恢复，这不会影响其他日期的记录。', [
      { style: 'cancel', text: '保留' },
      {
        onPress: () => {
          void removeSession();
        },
        style: 'destructive',
        text: '删除',
      },
    ]);
  }

  async function removeSession() {
    if (!loaded || operation.current) return;
    operation.current = true;
    setBusy(true);

    try {
      await deleteSession(loaded.record.id, { generation: loaded.generation });
      authSessionContext.assertGeneration(loaded.generation);
      if (focused.current) router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '记录删除失败');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppTopBar
        fallbackHref={routes.trends}
        right={
          session && !authLoading ? (
            <Pressable
              accessibilityLabel="删除本次记录"
              accessibilityRole="button"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.headerDeleteButton, pressed ? styles.headerDeleteButtonPressed : null]}
            >
              <Text style={styles.headerDeleteText}>删除</Text>
            </Pressable>
          ) : null
        }
        title="本次记录"
      />
      {isLoading ? (
        <AppCard muted style={styles.statusCard}>
          <Text style={styles.statusTitle}>正在读取本次记录…</Text>
        </AppCard>
      ) : null}

      {!isLoading && !session ? (
        <AppCard style={styles.statusCard}>
          <Text style={styles.statusTitle}>{error ? '记录读取失败' : '这条记录已不在本机'}</Text>
          <Text style={styles.statusBody}>{error ?? '可能已在其他页面删除。'}</Text>
          {error ? (
            <AppButton variant="secondary" onPress={() => setRetry((value) => value + 1)}>
              重新读取
            </AppButton>
          ) : null}
        </AppCard>
      ) : null}

      {session && !isLoading && !authLoading ? (
        <>
          <PageHeader subtitle={`${formatSessionDate(session.endedAt)} · 开始时间不支持修改`} title="把这趟记清楚" />
          <ToiletRecordForm
            key={`${loaded?.generation}:${session.id}`}
            disabled={busy}
            initialValue={createToiletRecordDraft(session)}
            onOpenSafety={() => router.push(routes.safety)}
            onSubmit={saveSession}
            submitLabel="保存修改"
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 14,
    },
    headerDeleteButton: {
      alignItems: 'center',
      backgroundColor: colors.dangerSoft,
      borderRadius: 20,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 11,
    },
    headerDeleteButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    headerDeleteText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '900',
    },
    statusBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
      marginTop: 5,
      textAlign: 'center',
    },
    statusCard: {
      alignItems: 'center',
      marginTop: 20,
      padding: 20,
    },
    statusButton: {
      alignSelf: 'stretch',
      marginTop: 16,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
  });
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
