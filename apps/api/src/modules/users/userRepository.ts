import { and, eq, isNull } from 'drizzle-orm';

import type { UpdateUserProfileRequest } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { deserializeAvatarConfig, serializeAvatarConfig } from './avatarConfig.js';
import type { CurrentUser } from './userTypes.js';
import { mockCurrentUser } from './userTypes.js';

export type UserRepository = {
  findById: (userId: string) => Promise<CurrentUser | null>;
  updateProfile: (userId: string, input: UpdateUserProfileRequest) => Promise<CurrentUser>;
  upsertFromApple: (input: { appleUserId: string; nickname?: string }) => Promise<CurrentUser>;
};

function toCurrentUser(user: typeof users.$inferSelect): CurrentUser {
  return {
    appleUserId: user.appleUserId,
    avatarUrl: deserializeAvatarConfig(user.avatarUrl),
    id: user.id,
    nickname: user.nickname,
    timezone: user.timezone,
  };
}

export function createMockUserRepository(): UserRepository {
  const usersByAppleUserId = new Map<string, CurrentUser>();
  const usersById = new Map<string, CurrentUser>();

  function createMockUser(input: { appleUserId: string; nickname?: string }) {
    const index = usersByAppleUserId.size + 1;
    const user: CurrentUser = {
      appleUserId: input.appleUserId,
      avatarUrl: null,
      id: index === 1 ? mockCurrentUser.id : `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      nickname: input.nickname ?? (index === 1 ? mockCurrentUser.nickname : `小提督用户 ${index}`),
      timezone: 'Asia/Shanghai',
    };

    usersByAppleUserId.set(input.appleUserId, user);
    usersById.set(user.id, user);

    return user;
  }

  return {
    async findById(userId) {
      return usersById.get(userId) ?? null;
    },
    async updateProfile(userId, input) {
      const existingUser = usersById.get(userId);

      if (!existingUser) {
        throw new Error('User not found.');
      }

      const updatedUser = {
        ...existingUser,
        avatarUrl: input.avatarUrl === undefined ? existingUser.avatarUrl : input.avatarUrl,
        nickname: input.nickname === undefined ? existingUser.nickname : input.nickname,
        timezone: input.timezone ?? existingUser.timezone,
      };

      usersByAppleUserId.set(updatedUser.appleUserId, updatedUser);
      usersById.set(updatedUser.id, updatedUser);

      return updatedUser;
    },
    async upsertFromApple(input) {
      const existingUser = usersByAppleUserId.get(input.appleUserId);

      if (!existingUser) {
        return createMockUser(input);
      }

      if (!input.nickname) {
        return existingUser;
      }

      const updatedUser = {
        ...existingUser,
        nickname: input.nickname,
      };

      usersByAppleUserId.set(input.appleUserId, updatedUser);
      usersById.set(updatedUser.id, updatedUser);

      return updatedUser;
    },
  };
}

export function createDrizzleUserRepository(db: Database): UserRepository {
  return {
    async findById(userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);

      return user ? toCurrentUser(user) : null;
    },
    async updateProfile(userId, input) {
      const [updatedUser] = await db
        .update(users)
        .set({
          ...(input.avatarUrl === undefined ? {} : { avatarUrl: serializeAvatarConfig(input.avatarUrl) }),
          ...(input.nickname === undefined ? {} : { nickname: input.nickname }),
          ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found.');
      }

      return toCurrentUser(updatedUser);
    },
    async upsertFromApple(input) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.appleUserId, input.appleUserId), isNull(users.deletedAt)))
        .limit(1);

      if (existingUser) {
        const [updatedUser] = await db
          .update(users)
          .set({
            nickname: input.nickname ?? existingUser.nickname,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        return toCurrentUser(updatedUser ?? existingUser);
      }

      const [createdUser] = await db
        .insert(users)
        .values({
          appleUserId: input.appleUserId,
          nickname: input.nickname,
        })
        .returning();

      if (!createdUser) {
        throw new Error('Failed to create user.');
      }

      return toCurrentUser(createdUser);
    },
  };
}
