CREATE TYPE "public"."auto_renew_status" AS ENUM('on', 'off', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."buddy_nudge_ack_status" AS ENUM('received', 'later', 'done');--> statement-breakpoint
CREATE TYPE "public"."buddy_nudge_type" AS ENUM('gentle', 'move', 'not_blank', 'habit_left', 'posture');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."push_provider" AS ENUM('expo', 'apns');--> statement-breakpoint
CREATE TYPE "public"."subscription_environment" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'grace_period', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('owner', 'buddy');--> statement-breakpoint
CREATE TYPE "public"."team_member_status" AS ENUM('active', 'paused', 'removed');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buddy_nudge_acks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nudge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "buddy_nudge_ack_status" NOT NULL,
	"revision_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buddy_nudge_acks_revision_count_check" CHECK ("buddy_nudge_acks"."revision_count" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "buddy_nudge_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"buddy_user_id" uuid NOT NULL,
	"daily_limit" smallint DEFAULT 5 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buddy_nudge_settings_daily_limit_check" CHECK ("buddy_nudge_settings"."daily_limit" in (0, 3, 5, 8))
);
--> statement-breakpoint
CREATE TABLE "buddy_nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"type" "buddy_nudge_type" NOT NULL,
	"message_template" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_report_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"training_done" boolean DEFAULT false NOT NULL,
	"habit_completion" smallint DEFAULT 0 NOT NULL,
	"habit_full" boolean DEFAULT false NOT NULL,
	"toilet_recorded" boolean DEFAULT false NOT NULL,
	"toilet_long_meeting" boolean DEFAULT false NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"weekly_training_days" smallint DEFAULT 0 NOT NULL,
	"weekly_habit_full_days" smallint DEFAULT 0 NOT NULL,
	"weekly_toilet_long_meeting_count" smallint DEFAULT 0 NOT NULL,
	"thirty_day_training_days" smallint DEFAULT 0 NOT NULL,
	"thirty_day_habit_full_days" smallint DEFAULT 0 NOT NULL,
	"thirty_day_toilet_long_meeting_count" smallint DEFAULT 0 NOT NULL,
	"ninety_day_training_days" smallint DEFAULT 0 NOT NULL,
	"ninety_day_habit_full_days" smallint DEFAULT 0 NOT NULL,
	"ninety_day_toilet_long_meeting_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_report_snapshots_habit_completion_check" CHECK ("daily_report_snapshots"."habit_completion" between 0 and 4),
	CONSTRAINT "daily_report_snapshots_streak_days_check" CHECK ("daily_report_snapshots"."streak_days" >= 0),
	CONSTRAINT "daily_report_snapshots_weekly_training_days_check" CHECK ("daily_report_snapshots"."weekly_training_days" between 0 and 7),
	CONSTRAINT "daily_report_snapshots_weekly_habit_full_days_check" CHECK ("daily_report_snapshots"."weekly_habit_full_days" between 0 and 7),
	CONSTRAINT "daily_report_snapshots_weekly_long_meeting_check" CHECK ("daily_report_snapshots"."weekly_toilet_long_meeting_count" >= 0),
	CONSTRAINT "daily_report_snapshots_thirty_day_training_days_check" CHECK ("daily_report_snapshots"."thirty_day_training_days" between 0 and 30),
	CONSTRAINT "daily_report_snapshots_thirty_day_habit_full_days_check" CHECK ("daily_report_snapshots"."thirty_day_habit_full_days" between 0 and 30),
	CONSTRAINT "daily_report_snapshots_thirty_day_long_meeting_check" CHECK ("daily_report_snapshots"."thirty_day_toilet_long_meeting_count" >= 0),
	CONSTRAINT "daily_report_snapshots_ninety_day_training_days_check" CHECK ("daily_report_snapshots"."ninety_day_training_days" between 0 and 90),
	CONSTRAINT "daily_report_snapshots_ninety_day_habit_full_days_check" CHECK ("daily_report_snapshots"."ninety_day_habit_full_days" between 0 and 90),
	CONSTRAINT "daily_report_snapshots_ninety_day_long_meeting_check" CHECK ("daily_report_snapshots"."ninety_day_toilet_long_meeting_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "daily_share_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"training_done" boolean DEFAULT false NOT NULL,
	"habit_completion" smallint DEFAULT 0 NOT NULL,
	"toilet_recorded" boolean DEFAULT false NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_share_snapshots_habit_completion_check" CHECK ("daily_share_snapshots"."habit_completion" between 0 and 4),
	CONSTRAINT "daily_share_snapshots_streak_days_check" CHECK ("daily_share_snapshots"."streak_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "push_platform" NOT NULL,
	"provider" "push_provider" DEFAULT 'expo' NOT NULL,
	"token" text NOT NULL,
	"device_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_training" boolean DEFAULT true NOT NULL,
	"share_habit_completion" boolean DEFAULT true NOT NULL,
	"share_toilet_recorded" boolean DEFAULT true NOT NULL,
	"share_streak" boolean DEFAULT true NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"original_transaction_id" text,
	"transaction_id" text,
	"environment" "subscription_environment" DEFAULT 'sandbox' NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"original_transaction_id" text NOT NULL,
	"latest_transaction_id" text,
	"environment" "subscription_environment" DEFAULT 'sandbox' NOT NULL,
	"app_account_token" uuid,
	"status" "subscription_status" DEFAULT 'expired' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"auto_renew_status" "auto_renew_status" DEFAULT 'unknown' NOT NULL,
	"last_notification_type" text,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_member_role" NOT NULL,
	"status" "team_member_status" DEFAULT 'active' NOT NULL,
	"display_name" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text DEFAULT '我的小队' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apple_user_id" text NOT NULL,
	"nickname" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudge_acks" ADD CONSTRAINT "buddy_nudge_acks_nudge_id_buddy_nudges_id_fk" FOREIGN KEY ("nudge_id") REFERENCES "public"."buddy_nudges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudge_acks" ADD CONSTRAINT "buddy_nudge_acks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudge_settings" ADD CONSTRAINT "buddy_nudge_settings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudge_settings" ADD CONSTRAINT "buddy_nudge_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudge_settings" ADD CONSTRAINT "buddy_nudge_settings_buddy_user_id_users_id_fk" FOREIGN KEY ("buddy_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudges" ADD CONSTRAINT "buddy_nudges_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudges" ADD CONSTRAINT "buddy_nudges_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_nudges" ADD CONSTRAINT "buddy_nudges_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_report_snapshots" ADD CONSTRAINT "daily_report_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_share_snapshots" ADD CONSTRAINT "daily_share_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_settings" ADD CONSTRAINT "share_settings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_settings" ADD CONSTRAINT "share_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_user_created_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_nudge_acks_nudge_user_unique" ON "buddy_nudge_acks" USING btree ("nudge_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_nudge_settings_team_user_buddy_unique" ON "buddy_nudge_settings" USING btree ("team_id","user_id","buddy_user_id");--> statement-breakpoint
CREATE INDEX "buddy_nudges_to_created_idx" ON "buddy_nudges" USING btree ("to_user_id","created_at");--> statement-breakpoint
CREATE INDEX "buddy_nudges_from_to_created_idx" ON "buddy_nudges" USING btree ("from_user_id","to_user_id","created_at");--> statement-breakpoint
CREATE INDEX "daily_report_snapshots_user_date_idx" ON "daily_report_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_report_snapshots_user_date_unique" ON "daily_report_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_share_snapshots_user_date_idx" ON "daily_share_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_share_snapshots_user_date_unique" ON "daily_share_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "push_tokens_user_enabled_idx" ON "push_tokens" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_provider_token_unique" ON "push_tokens" USING btree ("provider","token");--> statement-breakpoint
CREATE UNIQUE INDEX "share_settings_team_user_unique" ON "share_settings" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "subscription_events_original_transaction_idx" ON "subscription_events" USING btree ("original_transaction_id");--> statement-breakpoint
CREATE INDEX "subscription_events_received_at_idx" ON "subscription_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_original_transaction_id_unique" ON "subscriptions" USING btree ("original_transaction_id");--> statement-breakpoint
CREATE INDEX "team_invites_team_idx" ON "team_invites" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invites_token_hash_unique" ON "team_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "team_members_team_status_idx" ON "team_members" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "team_members_user_status_idx" ON "team_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_active_unique" ON "team_members" USING btree ("team_id","user_id") WHERE "team_members"."removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_owner_active_unique" ON "teams" USING btree ("owner_user_id") WHERE "teams"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_apple_user_id_active_unique" ON "users" USING btree ("apple_user_id") WHERE "users"."deleted_at" is null;