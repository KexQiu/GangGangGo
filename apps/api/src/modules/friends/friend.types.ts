import type {
  CreateFriendInviteResponse,
  CreateFriendNudgeRequest,
  FriendDataResponse,
  FriendEvent,
  FriendEventsResponse,
  FriendInvitePreviewResponse,
  FriendNudgeAckResponse,
  FriendNudgeAckStatus,
  FriendResponse,
  FriendsResponse,
  UpdateFriendSettingsRequest,
} from '@xiaotidu/contracts';

import type { CurrentUser } from '../users/userTypes.js';

export type ToiletFinishedSyncEvent = {
  durationSeconds: number;
  endedAt: string;
  sourceEntityId: string;
};

export type FriendService = {
  acceptInvite: (currentUser: CurrentUser, token: string) => Promise<FriendResponse>;
  ackNudge: (
    currentUser: CurrentUser,
    eventId: string,
    status: FriendNudgeAckStatus,
  ) => Promise<FriendNudgeAckResponse>;
  createInvite: (currentUser: CurrentUser) => Promise<CreateFriendInviteResponse>;
  deleteFriend: (currentUser: CurrentUser, friendUserId: string) => Promise<void>;
  getFriend: (currentUser: CurrentUser, friendUserId: string) => Promise<FriendResponse>;
  getFriendData: (currentUser: CurrentUser, friendUserId: string) => Promise<FriendDataResponse>;
  listEvents: (
    currentUser: CurrentUser,
    friendUserId: string,
    options: { before?: string; limit: number },
  ) => Promise<FriendEventsResponse>;
  listFriends: (currentUser: CurrentUser) => Promise<FriendsResponse>;
  previewInvite: (token: string) => Promise<FriendInvitePreviewResponse>;
  recordToiletFinished: (currentUser: CurrentUser, event: ToiletFinishedSyncEvent) => Promise<void>;
  sendNudge: (currentUser: CurrentUser, friendUserId: string, input: CreateFriendNudgeRequest) => Promise<FriendEvent>;
  updateSettings: (
    currentUser: CurrentUser,
    friendUserId: string,
    input: UpdateFriendSettingsRequest,
  ) => Promise<FriendResponse>;
};
