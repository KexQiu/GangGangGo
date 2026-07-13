import type { BuddyNudge, BuddyNudgeAckStatus, BuddyNudgeType, NudgeThreadSummary } from '@xiaotidu/contracts';

type NudgeBuddy = BuddyNudge['fromUser'];

export type NudgeThread = NudgeThreadSummary;

export type NudgeChatMessage = {
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  id: string;
  nudge: BuddyNudge;
  sender: NudgeBuddy;
  text: string;
};

export type NudgeHomeSummary = {
  latestAt: null | string;
  latestPreview: null | string;
  pendingCount: number;
};

export const nudgeCopies: Record<BuddyNudgeType, string> = {
  gentle: '轻轻戳一下',
  habit_left: '补一笔小账',
  move: '走两步',
  not_blank: '留个小进展',
  posture: '肩颈放松',
};

export const nudgeActionTypes: BuddyNudgeType[] = ['move', 'not_blank', 'habit_left', 'posture'];

export const ackCopies: Record<BuddyNudgeAckStatus, string> = {
  done: '已完成',
  later: '等会儿',
  received: '收到',
};

export const ackStatuses: BuddyNudgeAckStatus[] = ['received', 'later', 'done'];

export function getNudgeChatMessages(input: {
  currentUserId: null | string | undefined;
  nudges: BuddyNudge[];
}): NudgeChatMessage[] {
  if (!input.currentUserId) return [];
  const currentUserId = input.currentUserId;

  return mergeNudges(input.nudges)
    .map((nudge) => getMessageForNudge(nudge, currentUserId))
    .sort(sortMessagesAsc);
}

export function getNudgeHomeSummaryFromThreads(threads: NudgeThreadSummary[]): NudgeHomeSummary {
  const pendingCount = threads.reduce((total, thread) => total + thread.pendingCount, 0);
  const latestThread = threads.reduce<NudgeThreadSummary | undefined>((latest, thread) => {
    if (!thread.latestAt) return latest;
    if (!latest?.latestAt || isAfter(thread.latestAt, latest.latestAt)) return thread;
    return latest;
  }, undefined);

  return {
    latestAt: latestThread?.latestAt ?? null,
    latestPreview: latestThread?.latestPreview ?? null,
    pendingCount,
  };
}

export function getDisplayName(user: NudgeBuddy): string {
  return user.nickname ?? '小提督搭子';
}

export function mergeNudges(nudges: BuddyNudge[]): BuddyNudge[] {
  const nudgesById = new Map<string, BuddyNudge>();

  for (const nudge of nudges) {
    const existingNudge = nudgesById.get(nudge.id);
    if (!existingNudge || isAfter(getNudgeUpdatedAt(nudge), getNudgeUpdatedAt(existingNudge))) {
      nudgesById.set(nudge.id, nudge);
    }
  }

  return [...nudgesById.values()];
}

function getNudgeUpdatedAt(nudge: BuddyNudge): string {
  return nudge.ack?.updatedAt ?? nudge.createdAt;
}

function getMessageForNudge(nudge: BuddyNudge, currentUserId: string): NudgeChatMessage {
  const direction: NudgeChatMessage['direction'] = nudge.fromUser.id === currentUserId ? 'outgoing' : 'incoming';

  return {
    createdAt: nudge.createdAt,
    direction,
    id: nudge.id,
    nudge,
    sender: nudge.fromUser,
    text: nudge.messageTemplate,
  };
}

function isAfter(value: string, comparedValue: null | string): boolean {
  if (!comparedValue) return true;
  return new Date(value).getTime() > new Date(comparedValue).getTime();
}

function sortMessagesAsc(left: NudgeChatMessage, right: NudgeChatMessage) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}
