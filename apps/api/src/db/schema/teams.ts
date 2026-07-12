import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './common.js';
import { teamMemberRoleEnum, teamMemberStatusEnum } from './enums.js';
import { users } from './users.js';

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('我的小队'),
    createdAt,
    updatedAt,
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('teams_owner_active_unique')
      .on(table.ownerUserId)
      .where(sql`${table.archivedAt} is null`),
  ],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamMemberRoleEnum('role').notNull(),
    status: teamMemberStatusEnum('status').notNull().default('active'),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    index('team_members_team_status_idx').on(table.teamId, table.status),
    index('team_members_user_status_idx').on(table.userId, table.status),
    uniqueIndex('team_members_active_unique')
      .on(table.teamId, table.userId)
      .where(sql`${table.removedAt} is null`),
    uniqueIndex('team_members_user_current_unique')
      .on(table.userId)
      .where(sql`${table.removedAt} is null`),
  ],
);

export const teamInvites = pgTable(
  'team_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    inviterUserId: uuid('inviter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index('team_invites_team_idx').on(table.teamId),
    uniqueIndex('team_invites_token_hash_unique').on(table.tokenHash),
  ],
);
