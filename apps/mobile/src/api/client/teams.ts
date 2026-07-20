import type {
  AcceptTeamInviteRequest,
  AcceptTeamInviteResponse,
  CreateTeamInviteResponse,
  CreateTeamRequest,
  DailyShareSnapshotResponse,
  ShareSettingsResponse,
  TeamInvitePreviewResponse,
  TeamResponse,
  TeamSnapshotsResponse,
  UpdateShareSettingsRequest,
  UpdateTeamMemberStatusRequest,
  UpdateTeamRequest,
  UpsertDailyShareSnapshotRequest,
} from '@xiaotidu/contracts';
import {
  createTeamInviteResponseSchema,
  dailyShareSnapshotResponseSchema,
  shareSettingsResponseSchema,
  teamInvitePreviewResponseSchema,
  teamResponseSchema,
  teamSnapshotsResponseSchema,
} from '@xiaotidu/contracts';

import { request } from './core';

export const teamsApi = {
  acceptTeamInvite: (token: string, body: AcceptTeamInviteRequest, accessToken: string) =>
    request<AcceptTeamInviteResponse>(`/team-invites/${encodeURIComponent(token)}/accept`, teamResponseSchema, {
      body,
      method: 'POST',
      token: accessToken,
    }),
  createTeam: (body: CreateTeamRequest, token: string) =>
    request<TeamResponse>('/teams', teamResponseSchema, { body, method: 'POST', token }),
  createTeamInvite: (token: string) =>
    request<CreateTeamInviteResponse>('/teams/current/invites', createTeamInviteResponseSchema, {
      method: 'POST',
      token,
    }),
  getCurrentTeam: (token: string, signal?: AbortSignal) =>
    request<TeamResponse>('/teams/current', teamResponseSchema, { signal, token }),
  getTeamInvitePreview: (token: string, signal?: AbortSignal) =>
    request<TeamInvitePreviewResponse>(`/team-invites/${encodeURIComponent(token)}`, teamInvitePreviewResponseSchema, {
      signal,
    }),
  getTeamSnapshots: (token: string, signal?: AbortSignal) =>
    request<TeamSnapshotsResponse>('/teams/current/snapshots', teamSnapshotsResponseSchema, { signal, token }),
  leaveTeam: (token: string) =>
    request<TeamResponse>('/teams/current/leave', teamResponseSchema, { method: 'POST', token }),
  removeMember: (memberId: string, token: string) =>
    request<TeamResponse>(`/teams/current/members/${memberId}`, teamResponseSchema, { method: 'DELETE', token }),
  updateMyMemberStatus: (body: UpdateTeamMemberStatusRequest, token: string) =>
    request<TeamResponse>('/teams/current/members/me/status', teamResponseSchema, { body, method: 'PATCH', token }),
  updateShareSettings: (body: UpdateShareSettingsRequest, token: string) =>
    request<ShareSettingsResponse>('/share-settings', shareSettingsResponseSchema, { body, method: 'PUT', token }),
  updateTeam: (body: UpdateTeamRequest, token: string) =>
    request<TeamResponse>('/teams/current', teamResponseSchema, { body, method: 'PATCH', token }),
  upsertShareSnapshot: (body: UpsertDailyShareSnapshotRequest, token: string) =>
    request<DailyShareSnapshotResponse>('/share-snapshots/today', dailyShareSnapshotResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
};
