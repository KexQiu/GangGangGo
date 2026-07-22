import type { DataSyncPushRequest, DataSyncPullResponse, DataSyncPushResponse } from '@xiaotidu/contracts';
import { dataSyncPullResponseSchema, dataSyncPushResponseSchema } from '@xiaotidu/contracts';

import { request } from './core';

export const dataSyncApi = {
  pull: (cursor: string, token: string) =>
    request<DataSyncPullResponse>(`/data-sync/pull?cursor=${encodeURIComponent(cursor)}`, dataSyncPullResponseSchema, {
      token,
    }),
  push: (body: DataSyncPushRequest, token: string) =>
    request<DataSyncPushResponse>('/data-sync/push', dataSyncPushResponseSchema, {
      body,
      method: 'PUT',
      token,
    }),
};
