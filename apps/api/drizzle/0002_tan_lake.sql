CREATE TYPE "public"."friend_data_level" AS ENUM('none', 'summary', 'detailed');--> statement-breakpoint
CREATE TYPE "public"."friend_event_kind" AS ENUM('manual_nudge', 'toilet_finished');--> statement-breakpoint
CREATE TYPE "public"."friend_nudge_ack_status" AS ENUM('received', 'later', 'done');--> statement-breakpoint
CREATE TYPE "public"."friend_nudge_type" AS ENUM('gentle', 'move', 'not_blank', 'habit_left', 'posture');--> statement-breakpoint
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
ALTER TABLE "friend_event_acks" ADD CONSTRAINT "friend_event_acks_event_id_friend_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."friend_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_event_acks" ADD CONSTRAINT "friend_event_acks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_events" ADD CONSTRAINT "friend_events_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_events" ADD CONSTRAINT "friend_events_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_events" ADD CONSTRAINT "friend_events_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invites" ADD CONSTRAINT "friend_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invites" ADD CONSTRAINT "friend_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD CONSTRAINT "friend_nudge_daily_counters_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD CONSTRAINT "friend_nudge_daily_counters_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_settings" ADD CONSTRAINT "friend_settings_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_settings" ADD CONSTRAINT "friend_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_lower_user_id_users_id_fk" FOREIGN KEY ("lower_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_upper_user_id_users_id_fk" FOREIGN KEY ("upper_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_event_acks_event_user_unique" ON "friend_event_acks" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "friend_event_acks_user_idx" ON "friend_event_acks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_events_friendship_occurred_idx" ON "friend_events" USING btree ("friendship_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "friend_events_to_occurred_idx" ON "friend_events" USING btree ("to_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "friend_events_from_occurred_idx" ON "friend_events" USING btree ("from_user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_events_toilet_source_unique" ON "friend_events" USING btree ("friendship_id","from_user_id","to_user_id","source_entity_id") WHERE "friend_events"."kind" = 'toilet_finished' and "friend_events"."source_entity_id" is not null;--> statement-breakpoint
CREATE INDEX "friend_invites_inviter_created_idx" ON "friend_invites" USING btree ("inviter_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_invites_token_hash_unique" ON "friend_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_nudge_daily_counter_unique" ON "friend_nudge_daily_counters" USING btree ("from_user_id","to_user_id","local_date");--> statement-breakpoint
CREATE INDEX "friend_nudge_daily_counter_to_idx" ON "friend_nudge_daily_counters" USING btree ("to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_settings_friendship_user_unique" ON "friend_settings" USING btree ("friendship_id","user_id");--> statement-breakpoint
CREATE INDEX "friend_settings_user_idx" ON "friend_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_unique" ON "friendships" USING btree ("lower_user_id","upper_user_id");--> statement-breakpoint
CREATE INDEX "friendships_upper_user_idx" ON "friendships" USING btree ("upper_user_id");