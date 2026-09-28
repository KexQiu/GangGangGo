CREATE TYPE "public"."auto_renew_status" AS ENUM('on', 'off', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."friend_data_level" AS ENUM('none', 'summary', 'detailed');--> statement-breakpoint
CREATE TYPE "public"."friend_event_kind" AS ENUM('manual_nudge', 'toilet_finished');--> statement-breakpoint
CREATE TYPE "public"."friend_nudge_ack_status" AS ENUM('received', 'later', 'done');--> statement-breakpoint
CREATE TYPE "public"."friend_nudge_type" AS ENUM('gentle', 'move', 'not_blank', 'habit_left', 'posture');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."push_provider" AS ENUM('expo', 'apns');--> statement-breakpoint
CREATE TYPE "public"."subscription_environment" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'grace_period', 'expired', 'revoked');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "daily_activity_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"summary" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sync_changes" (
	"version" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mutation_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sync_changes_operation_check" CHECK ("data_sync_changes"."operation" in ('upsert', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "synced_habit_checkins" (
	"record_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"bowel" text,
	"fiber" text,
	"local_date" date NOT NULL,
	"movement" text,
	"water" text,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synced_toilet_sessions" (
	"record_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"bleeding" boolean DEFAULT false NOT NULL,
	"discomfort" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"feeling" text NOT NULL,
	"local_date" date NOT NULL,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"stool_color" text,
	"stool_shape" text,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "synced_toilet_sessions_duration_check" CHECK ("synced_toilet_sessions"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "synced_toilet_signal_presets" (
	"record_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synced_training_sessions" (
	"record_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"completed_repetitions" integer NOT NULL,
	"discomfort_reported" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"is_completed" boolean NOT NULL,
	"local_date" date NOT NULL,
	"preset_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "synced_training_sessions_duration_check" CHECK ("synced_training_sessions"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "friend_event_acks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "friend_nudge_ack_status" NOT NULL,
	"revision_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_event_acks_revision_count_check" CHECK ("friend_event_acks"."revision_count" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "friend_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"friendship_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"kind" "friend_event_kind" NOT NULL,
	"nudge_type" "friend_nudge_type",
	"message" text,
	"source_entity_id" text,
	"duration_seconds" integer,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_events_participants_differ_check" CHECK ("friend_events"."from_user_id" <> "friend_events"."to_user_id"),
	CONSTRAINT "friend_events_kind_fields_check" CHECK (("friend_events"."kind" = 'manual_nudge' and "friend_events"."nudge_type" is not null and "friend_events"."message" is not null and "friend_events"."expires_at" is not null) or ("friend_events"."kind" = 'toilet_finished' and "friend_events"."source_entity_id" is not null and "friend_events"."duration_seconds" is not null)),
	CONSTRAINT "friend_events_duration_check" CHECK ("friend_events"."duration_seconds" is null or "friend_events"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "friend_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_nudge_daily_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"friendship_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_nudge_daily_counter_count_check" CHECK ("friend_nudge_daily_counters"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "friend_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"friendship_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"training_level" "friend_data_level" DEFAULT 'none' NOT NULL,
	"habit_level" "friend_data_level" DEFAULT 'none' NOT NULL,
	"toilet_level" "friend_data_level" DEFAULT 'none' NOT NULL,
	"history_days" smallint DEFAULT 1 NOT NULL,
	"notify_friend_on_toilet_end" boolean DEFAULT false NOT NULL,
	"notify_friend_on_toilet_end_enabled_at" timestamp with time zone,
	"allow_toilet_end_notifications_from_friend" boolean DEFAULT false NOT NULL,
	"allow_toilet_end_notifications_enabled_at" timestamp with time zone,
	"nudges_enabled" boolean DEFAULT true NOT NULL,
	"nudge_daily_limit" smallint DEFAULT 5 NOT NULL,
	"quiet_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_settings_history_days_check" CHECK ("friend_settings"."history_days" in (1, 7, 30)),
	CONSTRAINT "friend_settings_nudge_daily_limit_check" CHECK ("friend_settings"."nudge_daily_limit" in (0, 3, 5, 8))
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lower_user_id" uuid NOT NULL,
	"upper_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_canonical_pair_check" CHECK ("friendships"."lower_user_id" < "friendships"."upper_user_id")
);
--> statement-breakpoint
CREATE TABLE "growth_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"installation_id" text NOT NULL,
	"user_id" uuid,
	"platform" text NOT NULL,
	"app_version" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity_summaries" ADD CONSTRAINT "daily_activity_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sync_changes" ADD CONSTRAINT "data_sync_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_habit_checkins" ADD CONSTRAINT "synced_habit_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_toilet_sessions" ADD CONSTRAINT "synced_toilet_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_toilet_signal_presets" ADD CONSTRAINT "synced_toilet_signal_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_training_sessions" ADD CONSTRAINT "synced_training_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_event_acks" ADD CONSTRAINT "friend_event_acks_event_id_friend_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."friend_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_event_acks" ADD CONSTRAINT "friend_event_acks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_events" ADD CONSTRAINT "friend_events_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_events" ADD CONSTRAINT "friend_events_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_events" ADD CONSTRAINT "friend_events_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invites" ADD CONSTRAINT "friend_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invites" ADD CONSTRAINT "friend_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD CONSTRAINT "friend_nudge_daily_counters_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD CONSTRAINT "friend_nudge_daily_counters_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD CONSTRAINT "friend_nudge_daily_counters_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_settings" ADD CONSTRAINT "friend_settings_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_settings" ADD CONSTRAINT "friend_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_lower_user_id_users_id_fk" FOREIGN KEY ("lower_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_upper_user_id_users_id_fk" FOREIGN KEY ("upper_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_events" ADD CONSTRAINT "growth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_user_created_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_active_idx" ON "auth_sessions" USING btree ("user_id","revoked_at","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_activity_summaries_user_date_unique" ON "daily_activity_summaries" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "daily_activity_summaries_expires_idx" ON "daily_activity_summaries" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_sync_changes_user_mutation_unique" ON "data_sync_changes" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE INDEX "data_sync_changes_user_version_idx" ON "data_sync_changes" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "data_sync_changes_expires_idx" ON "data_sync_changes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_habit_checkins_user_date_unique" ON "synced_habit_checkins" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_habit_checkins_user_record_unique" ON "synced_habit_checkins" USING btree ("user_id","record_id");--> statement-breakpoint
CREATE INDEX "synced_habit_checkins_expires_idx" ON "synced_habit_checkins" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_toilet_sessions_user_record_unique" ON "synced_toilet_sessions" USING btree ("user_id","record_id");--> statement-breakpoint
CREATE INDEX "synced_toilet_sessions_user_date_idx" ON "synced_toilet_sessions" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "synced_toilet_sessions_expires_idx" ON "synced_toilet_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_toilet_signal_presets_user_record_unique" ON "synced_toilet_signal_presets" USING btree ("user_id","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_toilet_signal_presets_user_label_unique" ON "synced_toilet_signal_presets" USING btree ("user_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_training_sessions_user_record_unique" ON "synced_training_sessions" USING btree ("user_id","record_id");--> statement-breakpoint
CREATE INDEX "synced_training_sessions_user_date_idx" ON "synced_training_sessions" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "synced_training_sessions_expires_idx" ON "synced_training_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_event_acks_event_user_unique" ON "friend_event_acks" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "friend_event_acks_user_idx" ON "friend_event_acks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_events_friendship_occurred_idx" ON "friend_events" USING btree ("friendship_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "friend_events_to_occurred_idx" ON "friend_events" USING btree ("to_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "friend_events_from_occurred_idx" ON "friend_events" USING btree ("from_user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_events_toilet_source_unique" ON "friend_events" USING btree ("friendship_id","from_user_id","to_user_id","source_entity_id") WHERE "friend_events"."kind" = 'toilet_finished' and "friend_events"."source_entity_id" is not null;--> statement-breakpoint
CREATE INDEX "friend_invites_inviter_created_idx" ON "friend_invites" USING btree ("inviter_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_invites_token_hash_unique" ON "friend_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_nudge_daily_counter_unique" ON "friend_nudge_daily_counters" USING btree ("friendship_id","from_user_id","to_user_id","local_date");--> statement-breakpoint
CREATE INDEX "friend_nudge_daily_counter_to_idx" ON "friend_nudge_daily_counters" USING btree ("to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_settings_friendship_user_unique" ON "friend_settings" USING btree ("friendship_id","user_id");--> statement-breakpoint
CREATE INDEX "friend_settings_user_idx" ON "friend_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_unique" ON "friendships" USING btree ("lower_user_id","upper_user_id");--> statement-breakpoint
CREATE INDEX "friendships_upper_user_idx" ON "friendships" USING btree ("upper_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_events_event_id_unique" ON "growth_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "growth_events_installation_occurred_idx" ON "growth_events" USING btree ("installation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "growth_events_user_occurred_idx" ON "growth_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "growth_events_name_occurred_idx" ON "growth_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "growth_events_received_at_idx" ON "growth_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "push_tokens_user_enabled_idx" ON "push_tokens" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_provider_token_unique" ON "push_tokens" USING btree ("provider","token");--> statement-breakpoint
CREATE INDEX "subscription_events_original_transaction_idx" ON "subscription_events" USING btree ("original_transaction_id");--> statement-breakpoint
CREATE INDEX "subscription_events_received_at_idx" ON "subscription_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_original_transaction_id_unique" ON "subscriptions" USING btree ("original_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_apple_user_id_active_unique" ON "users" USING btree ("apple_user_id") WHERE "users"."deleted_at" is null;