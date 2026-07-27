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
ALTER TABLE "growth_events" ADD CONSTRAINT "growth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_events_event_id_unique" ON "growth_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "growth_events_installation_occurred_idx" ON "growth_events" USING btree ("installation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "growth_events_user_occurred_idx" ON "growth_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "growth_events_name_occurred_idx" ON "growth_events" USING btree ("event_name","occurred_at");