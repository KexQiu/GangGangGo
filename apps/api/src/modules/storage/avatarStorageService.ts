import { randomUUID } from 'node:crypto';

import type { CreateAvatarUploadResponse } from '@xiaotidu/contracts';

import { ApiError } from '../../http/apiError.js';

const maxAvatarBytes = 300 * 1024;
const uploadTtlMs = 5 * 60 * 1000;

type AvatarUploadInput = {
  contentLength: number;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  origin: string;
  userId: string;
};

type MockAvatarObject = {
  body: Uint8Array;
  contentType: string;
  expiresAt: Date;
};

type PendingUpload = {
  contentLength: number;
  contentType: string;
  expiresAt: Date;
  objectKey: string;
};

export type AvatarStorageService = {
  createUpload: (input: AvatarUploadInput) => Promise<CreateAvatarUploadResponse>;
  getMockObject: (objectKey: string) => MockAvatarObject | null;
  putMockObject: (input: {
    body: ArrayBuffer;
    contentType: string | null;
    objectKey: string;
    token: string | null;
  }) => Promise<void>;
};

function normalizeOrigin(origin: string) {
  return origin.replace(/\/$/, '');
}

function getExtension(contentType: AvatarUploadInput['contentType']) {
  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

export function createMockAvatarStorageService(): AvatarStorageService {
  const pendingUploads = new Map<string, PendingUpload>();
  const objects = new Map<string, MockAvatarObject>();

  return {
    async createUpload(input) {
      if (input.contentLength <= 0 || input.contentLength > maxAvatarBytes) {
        throw new ApiError(400, 'validation_error', '头像图片不能超过 300KB。');
      }

      const uploadId = randomUUID();
      const token = randomUUID();
      const objectKey = `avatars/${input.userId}/${uploadId}.${getExtension(input.contentType)}`;
      const expiresAt = new Date(Date.now() + uploadTtlMs);
      const encodedObjectKey = encodeURIComponent(objectKey);
      const origin = normalizeOrigin(input.origin);

      pendingUploads.set(token, {
        contentLength: input.contentLength,
        contentType: input.contentType,
        expiresAt,
        objectKey,
      });

      return {
        expiresAt: expiresAt.toISOString(),
        objectKey,
        publicUrl: `${origin}/mock-storage/${encodedObjectKey}`,
        uploadMethod: 'mock_put',
        uploadUrl: `${origin}/mock-storage/${encodedObjectKey}?token=${token}`,
      };
    },
    getMockObject(objectKey) {
      return objects.get(objectKey) ?? null;
    },
    async putMockObject(input) {
      if (!input.token) {
        throw new ApiError(403, 'forbidden', '上传地址无效。');
      }

      const pendingUpload = pendingUploads.get(input.token);

      if (!pendingUpload || pendingUpload.objectKey !== input.objectKey) {
        throw new ApiError(403, 'forbidden', '上传地址无效。');
      }

      if (pendingUpload.expiresAt.getTime() < Date.now()) {
        pendingUploads.delete(input.token);
        throw new ApiError(403, 'forbidden', '上传地址已过期。');
      }

      if (input.body.byteLength > pendingUpload.contentLength || input.body.byteLength > maxAvatarBytes) {
        throw new ApiError(400, 'validation_error', '头像图片不能超过 300KB。');
      }

      const contentType = input.contentType ?? pendingUpload.contentType;

      if (contentType !== pendingUpload.contentType) {
        throw new ApiError(400, 'validation_error', '头像图片类型不匹配。');
      }

      objects.set(input.objectKey, {
        body: new Uint8Array(input.body),
        contentType,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      pendingUploads.delete(input.token);
    },
  };
}
