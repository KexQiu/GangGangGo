import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert, Text, View } from 'react-native';

import { authSessionContext } from '../../src/api/sessionContext';
import { AppButton } from '../../src/components/AppButton';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/account/authStore';
import { ToiletRecordForm } from '../../src/features/toilet/ToiletRecordForm';
import { createToiletRecordDraft } from '../../src/features/toilet/toiletRecordLogic';
import {
  discardPendingToiletRecord,
  getPendingToiletRecord,
  savePendingToiletRecord,
  updatePendingToiletRecord,
  type PendingToiletRecord,
} from '../../src/features/toilet/toiletDraftService';
import type { ToiletRecordDraft } from '../../src/features/toilet/toiletTypes';
import { useToiletStore } from '../../src/features/toilet/toiletStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function ToiletCompleteScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ draftId?: string }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : '';
  const accessToken = useAuthStore((state) => state.accessToken);
  const authLoading = useAuthStore((state) => state.isLoading || !state.hasHydrated);
  const [entry, setEntry] = useState<PendingToiletRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const active = useRef(false);
  const operation = useRef(false);
  const changeVersion = useRef(0);
  const latestValues = useRef<ToiletRecordDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      let current = true;
      setEntry(null);
      setLoading(true);
      setLoadError(null);
      setDraftError(null);
      if (!authLoading)
        void getPendingToiletRecord(draftId)
          .then((next) => {
            if (current) setEntry(next);
          })
          .catch((error) => {
            if (current) setLoadError(error instanceof Error ? error.message : '草稿读取失败');
          })
          .finally(() => {
            if (current) setLoading(false);
          });
      return () => {
        current = false;
        active.current = false;
        changeVersion.current += 1;
      };
      // 凭证变化与手动重试必须重新读取当前资料，即使查询不直接使用 token。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, accessToken, authLoading, retry]),
  );

  const updateDraft = useCallback(
    (values: ToiletRecordDraft) => {
      latestValues.current = values;
      if (!entry || operation.current) return;
      const version = ++changeVersion.current;
      setDraftSaving(true);
      setDraftError(null);
      void updatePendingToiletRecord(entry, values)
        .catch((error) => {
          if (active.current && version === changeVersion.current)
            setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试。');
        })
        .finally(() => {
          if (active.current && version === changeVersion.current) setDraftSaving(false);
        });
    },
    [entry],
  );

  async function saveSession(values: ToiletRecordDraft) {
    if (!entry || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await savePendingToiletRecord(entry, values);
      authSessionContext.assertGeneration(entry.generation);
      useToiletStore.getState().reset();
      await useToiletStore.getState().hydrate();
      authSessionContext.assertGeneration(entry.generation);
      if (active.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(routes.home);
      }
    } finally {
      operation.current = false;
      if (active.current) setBusy(false);
    }
  }

  function confirmDiscard() {
    if (!entry || operation.current) return;
    const target = entry;
    Alert.alert('放弃这份草稿？', '本次计时和已填写内容会被删除，无法恢复。', [
      { style: 'cancel', text: '保留草稿' },
      {
        style: 'destructive',
        text: '放弃草稿',
        onPress: () => {
          if (operation.current) return;
          operation.current = true;
          setBusy(true);
          void discardPendingToiletRecord(target)
            .then(() => {
              authSessionContext.assertGeneration(target.generation);
              if (active.current) router.replace(routes.toilet);
            })
            .catch((error) => {
              if (active.current) setDraftError(error instanceof Error ? error.message : '放弃失败，请重试。');
            })
            .finally(() => {
              operation.current = false;
              if (active.current) setBusy(false);
            });
        },
      },
    ]);
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.toilet} title="这趟记一下" variant="close" />
      <PageHeader
        subtitle="结束时间已固定。草稿仅保存在本机，可从“蹲会儿”继续填写，最多保留 90 天。"
        title="把这趟留个底"
      />
      {loading ? <Text style={{ color: colors.textMuted }}>正在读取草稿…</Text> : null}
      {!loading && loadError ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.danger }}>{loadError}</Text>
          <AppButton onPress={() => setRetry((value) => value + 1)} variant="secondary">
            重新读取
          </AppButton>
        </View>
      ) : null}
      {!loading && !loadError && !entry ? (
        <Text style={{ color: colors.textMuted }}>当前账号没有这份草稿，可能已保存、放弃或过期。</Text>
      ) : null}
      {entry && !loading && !authLoading ? (
        <>
          <Text accessibilityLiveRegion="polite" style={{ color: draftError ? colors.danger : colors.textMuted }}>
            {draftError ?? (draftSaving ? '正在保存草稿…' : '草稿已保留，可稍后继续填写。')}
          </Text>
          {draftError ? (
            <AppButton
              disabled={busy}
              onPress={() => {
                if (latestValues.current) updateDraft(latestValues.current);
              }}
              variant="secondary"
            >
              重试保存草稿
            </AppButton>
          ) : null}
          <ToiletRecordForm
            key={`${entry.generation}:${entry.record.id}`}
            initialValue={createToiletRecordDraft(entry.record)}
            disabled={busy}
            onDraftChange={updateDraft}
            onOpenSafety={() => router.push(routes.safety)}
            onSubmit={saveSession}
            submitLabel="记好了"
          />
          <AppButton disabled={busy} onPress={confirmDiscard} variant="secondary">
            放弃本次草稿
          </AppButton>
        </>
      ) : null}
    </Screen>
  );
}
