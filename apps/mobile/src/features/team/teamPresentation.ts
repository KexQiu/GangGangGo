import type { TeamMember, TeamSnapshot, TeamWeeklyReportResponse } from '@xiaotidu/contracts';

import type { NudgeThread } from '../nudges/nudgeModel';

type BuddyTextInput = {
  member: TeamMember;
  snapshot?: TeamSnapshot['snapshot'];
  thread?: NudgeThread;
};

export function getBuddyPrimaryText({ member, snapshot, thread }: BuddyTextInput) {
  if ((thread?.pendingCount ?? 0) > 0) return `${thread?.pendingCount ?? 0} 条提醒待回应`;
  if (thread?.latestAt) return thread.latestPreview;
  if (snapshot) return formatSnapshot(snapshot);
  if (member.status === 'paused') return '暂停共享中';
  return '今日未登录';
}

export function getBuddySecondaryText({ member, snapshot, thread }: BuddyTextInput) {
  if (member.status === 'paused') return '对方暂停共享中，暂时不能接收提醒。';
  if ((thread?.pendingCount ?? 0) > 0 && snapshot) return formatSnapshot(snapshot);
  if ((thread?.pendingCount ?? 0) > 0) return '今日未登录';
  if (thread?.latestAt && snapshot) return formatSnapshot(snapshot);
  if (thread?.latestAt) return '今日未登录';
  return null;
}

function formatSnapshot(snapshot: TeamSnapshot['snapshot'] | undefined) {
  if (!snapshot) return '今日未登录';

  const parts = [
    snapshot.trainingDone === undefined ? null : snapshot.trainingDone ? '小花已营业' : '小花待营业',
    snapshot.habitCompletion === undefined ? null : `小账本 ${snapshot.habitCompletion}/4`,
    snapshot.toiletRecorded === undefined ? null : snapshot.toiletRecorded ? '蹲会儿已记' : '蹲会儿未记',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '今天低调共享中';
}

export function formatThreadTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat('zh-CN', {
    day: isToday ? undefined : '2-digit',
    hour: isToday ? '2-digit' : undefined,
    hour12: false,
    minute: isToday ? '2-digit' : undefined,
    month: isToday ? undefined : '2-digit',
  }).format(date);
}

export function formatWeeklyReport(teamWeeklyReport: TeamWeeklyReportResponse | null) {
  if (!teamWeeklyReport) return '等大家同步一点低敏摘要，小报告就会出现。';

  const trainingDays = teamWeeklyReport.summaries.reduce((total, item) => total + item.trainingDays, 0);
  const habitFullDays = teamWeeklyReport.summaries.reduce((total, item) => total + item.habitFullDays, 0);

  return `小队 ${teamWeeklyReport.memberCount} 人 · 训练达标 ${trainingDays} 天 · 小账本满格 ${habitFullDays} 天`;
}
