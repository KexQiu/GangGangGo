import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';

import type { AuthSession } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { authSessions } from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import { issueAccessToken } from './token.js';

const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

type StoredSession = {
  expiresAt: Date;
  id: string;
  refreshTokenHash: string;
  revokedAt: Date | null;
  userId: string;
};

export type AuthSessionService = {
  create: (userId: string) => Promise<AuthSession>;
  isActive: (sessionId: string, userId: string) => Promise<boolean>;
  revoke: (sessionId: string) => Promise<void>;
  rotate: (refreshToken: string) => Promise<{ session: AuthSession; userId: string }>;
};

function createRefreshToken() {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function toAuthSession(stored: StoredSession, refreshToken: string): Promise<AuthSession> {
  const access = await issueAccessToken(stored.userId, stored.id);
  return { ...access, refreshToken };
}

export function createMockAuthSessionService(): AuthSessionService {
  const sessions = new Map<string, StoredSession>();

  async function create(userId: string) {
    const refreshToken = createRefreshToken();
    const stored: StoredSession = {
      expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
      id: randomUUID(),
      refreshTokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
      userId,
    };
    sessions.set(stored.id, stored);
    return toAuthSession(stored, refreshToken);
  }

  return {
    create,
    async isActive(sessionId, userId) {
      const session = sessions.get(sessionId);
      return Boolean(session && session.userId === userId && !session.revokedAt && session.expiresAt > new Date());
    },
    async revoke(sessionId) {
      const session = sessions.get(sessionId);
      if (session) session.revokedAt = new Date();
    },
    async rotate(refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const session = [...sessions.values()].find((item) => item.refreshTokenHash === tokenHash);
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new ApiError(401, 'unauthorized', '登录续期信息无效，请重新登录。');
      }
      session.revokedAt = new Date();
      return { session: await create(session.userId), userId: session.userId };
    },
  };
}

export function createDrizzleAuthSessionService(db: Database): AuthSessionService {
  async function create(userId: string) {
    const refreshToken = createRefreshToken();
    const [stored] = await db
      .insert(authSessions)
      .values({
        expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
        refreshTokenHash: hashRefreshToken(refreshToken),
        userId,
      })
      .returning();
    if (!stored) throw new Error('Failed to create auth session.');
    return toAuthSession(stored, refreshToken);
  }

  return {
    create,
    async isActive(sessionId, userId) {
      const [session] = await db
        .select({ id: authSessions.id })
        .from(authSessions)
        .where(
          and(
            eq(authSessions.id, sessionId),
            eq(authSessions.userId, userId),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);
      return Boolean(session);
    },
    async revoke(sessionId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(authSessions.id, sessionId));
    },
    async rotate(refreshToken) {
      return db.transaction(async (transaction) => {
        const tokenHash = hashRefreshToken(refreshToken);
        const [stored] = await transaction
          .select()
          .from(authSessions)
          .where(
            and(
              eq(authSessions.refreshTokenHash, tokenHash),
              isNull(authSessions.revokedAt),
              gt(authSessions.expiresAt, new Date()),
            ),
          )
          .for('update')
          .limit(1);
        if (!stored) throw new ApiError(401, 'unauthorized', '登录续期信息无效，请重新登录。');
        await transaction
          .update(authSessions)
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(authSessions.id, stored.id), isNull(authSessions.revokedAt)));

        const nextRefreshToken = createRefreshToken();
        const [next] = await transaction
          .insert(authSessions)
          .values({
            expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
            refreshTokenHash: hashRefreshToken(nextRefreshToken),
            userId: stored.userId,
          })
          .returning();
        if (!next) throw new Error('Failed to rotate auth session.');
        return { session: await toAuthSession(next, nextRefreshToken), userId: stored.userId };
      });
    },
  };
}
