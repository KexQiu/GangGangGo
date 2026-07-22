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
ALTER TABLE "daily_activity_summaries" ADD CONSTRAINT "daily_activity_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sync_changes" ADD CONSTRAINT "data_sync_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_habit_checkins" ADD CONSTRAINT "synced_habit_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_toilet_sessions" ADD CONSTRAINT "synced_toilet_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_toilet_signal_presets" ADD CONSTRAINT "synced_toilet_signal_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_training_sessions" ADD CONSTRAINT "synced_training_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "synced_training_sessions_expires_idx" ON "synced_training_sessions" USING btree ("expires_at");