import * as Notifications from 'expo-notifications';

const friendNotificationKinds = new Set(['friend-nudge', 'friend-nudge-ack', 'friend-toilet-finished']);

export function getFriendUserIdFromNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  return friendNotificationKinds.has(typeof data.kind === 'string' ? data.kind : '') &&
    typeof data.friendUserId === 'string' &&
    data.friendUserId.length > 0
    ? data.friendUserId
    : null;
}

export function subscribeToFriendNotificationResponses(onOpen: (friendUserId: string) => void) {
  let active = true;
  const handledIdentifiers = new Set<string>();
  const handle = (response: Notifications.NotificationResponse) => {
    const identifier = response.notification.request.identifier;
    if (handledIdentifiers.has(identifier)) return;
    const friendUserId = getFriendUserIdFromNotificationResponse(response);
    if (active && friendUserId) {
      handledIdentifiers.add(identifier);
      onOpen(friendUserId);
    }
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response || !active) return;
      handle(response);
      return Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => undefined);

  return () => {
    active = false;
    subscription.remove();
  };
}
