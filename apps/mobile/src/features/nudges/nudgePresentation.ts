export function getDisabledSendReason(input: {
  isPro: boolean;
  memberStatus: null | string | undefined;
  userId: null | string | undefined;
}) {
  if (!input.userId) return '没有找到这个搭子。';
  if (!input.isPro) return '主动提醒搭子需要小提督 Pro。';
  if (!input.memberStatus) return '这个搭子不在当前小队中，不能继续提醒。';
  if (input.memberStatus === 'paused') return '对方暂停共享中，暂时不能轻轻戳。';
  if (input.memberStatus !== 'active') return '这个搭子暂时不能接收提醒。';
  return null;
}

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(new Date(value));
}
