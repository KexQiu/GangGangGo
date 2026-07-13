import { useLocalSearchParams } from 'expo-router';

import NudgeThreadScreen from '../../../src/features/nudges/screens/NudgeThreadScreen';

export default function NudgeThreadRoute() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const buddyUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  return <NudgeThreadScreen buddyUserId={buddyUserId} />;
}
