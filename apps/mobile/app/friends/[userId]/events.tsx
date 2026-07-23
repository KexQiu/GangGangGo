import { useLocalSearchParams } from 'expo-router';

import FriendEventsScreen from '../../../src/features/friends/screens/FriendEventsScreen';

export default function FriendEventsRoute() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const friendUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  return <FriendEventsScreen friendUserId={friendUserId} />;
}
