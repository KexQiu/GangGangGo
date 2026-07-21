import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { ToiletRecordForm } from '../../src/features/toilet/ToiletRecordForm';
import { type ToiletRecordDraft, type ToiletSession } from '../../src/features/toilet/toiletTypes';
import { useToiletStore } from '../../src/features/toilet/toiletStore';
import { routes } from '../../src/navigation/routes';

export default function ToiletCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    durationSeconds?: string;
    startedAt?: string;
  }>();
  const addSession = useToiletStore((state) => state.addSession);
  const durationSeconds = toNumber(params.durationSeconds);
  const startedAt = typeof params.startedAt === 'string' ? params.startedAt : new Date().toISOString();

  async function saveSession(draft: ToiletRecordDraft) {
    const session: ToiletSession = {
      ...draft,
      endedAt: new Date().toISOString(),
      id: createSessionId(),
      startedAt,
    };

    await addSession(session);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(routes.home);
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="这趟记一下" variant="close" />
      <PageHeader subtitle="时长已自动带入，其他想记再记。" title="把这趟留个底" />
      <ToiletRecordForm
        initialValue={{
          bleeding: false,
          discomfort: false,
          durationSeconds,
          feeling: 'normal',
          signals: [],
          stoolColor: null,
          stoolShape: null,
        }}
        onOpenSafety={() => router.push(routes.safety)}
        onSubmit={saveSession}
        submitLabel="记好了"
      />
    </Screen>
  );
}

function toNumber(value: string | undefined): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.floor(numberValue)) : 0;
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
