import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import type { AuthSession } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { authSessions, pushTokens, users } from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import { issueAccessToken } from './token.js';

const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

type StoredSession = {
  expiresAt: Date;
  id: string;
  familyId: string;
  refreshTokenHash: string;
  revokedAt: Date | null;
  userId: string;
};

export class SessionUserUnavailableError extends Error {
  constructor() {
    super('The session user no longer exists.');
    this.name = 'SessionUserUnavailableError';
  }
}

export type AuthSessionService = {
  create: (userId: string) => Promise<AuthSession>;
  isActive: (sessionId: string, userId: string) => Promise<boolean>;
  revoke: (sessionId: string) => Promise<void>;
  revokeRefreshToken: (refreshToken: string) => Promise<void>;
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

  async function create(userId: string, familyId: string = randomUUID()) {
    const refreshToken = createRefreshToken();
    const stored: StoredSession = {
      expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
      id: randomUUID(),
      familyId,
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
      if (session)
        for (const row of sessions.values()) if (row.familyId === session.familyId) row.revokedAt = new Date();
    },
    async revokeRefreshToken(refreshToken) {
      const session = [...sessions.values()].find((row) => row.refreshTokenHash === hashRefreshToken(refreshToken));
      if (session)
        for (const row of sessions.values()) if (row.familyId === session.familyId) row.revokedAt = new Date();
    },
    async rotate(refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const session = [...sessions.values()].find((item) => item.refreshTokenHash === tokenHash);
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new ApiError(401, 'unauthorized', '登录续期信息无效，请重新登录。');
      }
      session.revokedAt = new Date();
      return { session: await create(session.userId, session.familyId), userId: session.userId };
    },
  };
}

export function createDrizzleAuthSessionService(db: Database): AuthSessionService {
  async function revokeFamily(condition: ReturnType<typeof eq>) {
    await db.transaction(async (tx) => {
      const [stored] = await tx.select().from(authSessions).where(condition).limit(1);
      if (!stored) return;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'auth-family:' + stored.familyId}, 0))`);
      await tx
        .update(authSessions)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(authSessions.familyId, stored.familyId));
    });
  }
  async function create(userId: string) {
    const refreshToken = createRefreshToken();
    const stored = await db.transaction(async (transaction) => {
      // Prevent fixture cleanup from deleting the user between login upsert and session creation.
      const [user] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for('key share')
        .limit(1);
      if (!user) throw new SessionUserUnavailableError();

      const [created] = await transaction
        .insert(authSessions)
        .values({
          expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
          refreshTokenHash: hashRefreshToken(refreshToken),
          userId,
        })
        .returning();
      if (!created) throw new Error('Failed to create auth session.');
      return created;
    });
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
      await revokeFamily(eq(authSessions.id, sessionId));
    },
    async revokeRefreshToken(refreshToken) {
      // Old refresh tokens are retained as revoke-only capabilities for their own family.
      // This also covers logout racing with a refresh whose response was lost.
      await revokeFamily(eq(authSessions.refreshTokenHash, hashRefreshToken(refreshToken)));
    },
    async rotate(refreshToken) {
      return db.transaction(async (transaction) => {
        const tokenHash = hashRefreshToken(refreshToken);
        const [family] = await transaction
          .select({ id: authSessions.familyId })
          .from(authSessions)
          .where(eq(authSessions.refreshTokenHash, tokenHash))
          .limit(1);
        if (!family) throw new ApiError(401, 'unauthorized', '登录续期信息无效，请重新登录。');
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${'auth-family:' + family.id}, 0))`,
        );
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
          .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
          })
          .where(and(eq(authSessions.id, stored.id), isNull(authSessions.revokedAt)));

        const nextRefreshToken = createRefreshToken();
        const [next] = await transaction
          .insert(authSessions)
          .values({
            familyId: stored.familyId,
            expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
            refreshTokenHash: hashRefreshToken(nextRefreshToken),
            userId: stored.userId,
          })
          .returning();
        if (!next) throw new Error('Failed to rotate auth session.');
        await transaction
          .update(pushTokens)
          .set({ sessionId: next.id, updatedAt: new Date() })
          .where(and(eq(pushTokens.sessionId, stored.id), eq(pushTokens.userId, stored.userId)));
        return { session: await toAuthSession(next, nextRefreshToken), userId: stored.userId };
      });
    },
  };
}
