import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';
import { useAuthStore } from '../../account/authStore';
import { subscribeToLocalDataChanges } from '../../sync/localDataEvents';
import { listPendingToiletRecords, type PendingToiletRecord } from '../toiletDraftService';
import { formatToiletDuration } from '../toiletLogic';

export function PendingToiletRecords() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const token = useAuthStore((state) => state.accessToken);
  const authLoading = useAuthStore((state) => state.isLoading || !state.hasHydrated);
  const [entries, setEntries] = useState<PendingToiletRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let request = 0;
      setEntries([]);
      setError(null);
      const refresh = () => {
        if (authLoading) return;
        const revision = ++request;
        void listPendingToiletRecords()
          .then((next) => {
            if (active && request === revision) {
              setEntries(next);
              setError(null);
            }
          })
          .catch((reason) => {
            if (active && request === revision) setError(reason instanceof Error ? reason.message : '草稿读取失败');
          });
      };
      refresh();
      const unsubscribe = subscribeToLocalDataChanges(refresh);
      return () => {
        active = false;
        unsubscribe();
      };
      // 凭证变化与手动重试必须重新读取当前资料，即使查询不直接使用 token。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, authLoading, retry]),
  );

  if (authLoading) return null;
  if (error)
    return (
      <AppCard>
        <Text style={{ color: colors.danger }}>{error}</Text>
        <AppButton variant="secondary" onPress={() => setRetry((value) => value + 1)}>
          重新读取草稿
        </AppButton>
      </AppCard>
    );
  if (!entries.length) return null;
  return (
    <AppCard>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>待补充的记录</Text>
      <Text style={{ color: colors.textMuted }}>草稿尚未计入统计，也不会上传。保存后才成为正式记录。</Text>
      {entries.map(({ record }) => (
        <View key={record.id} style={{ gap: 8 }}>
          <Text style={{ color: colors.textMuted }}>
            {new Date(record.endedAt).toLocaleString()} · {formatToiletDuration(record.durationSeconds)}
          </Text>
          <AppButton
            variant="secondary"
            onPress={() => router.push({ pathname: routes.toiletComplete, params: { draftId: record.id } })}
          >
            继续填写
          </AppButton>
        </View>
      ))}
    </AppCard>
  );
}
