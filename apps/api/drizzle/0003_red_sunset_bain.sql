DROP INDEX "friend_nudge_daily_counter_unique";--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD COLUMN "friendship_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_nudge_daily_counters" ADD CONSTRAINT "friend_nudge_daily_counters_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_nudge_daily_counter_unique" ON "friend_nudge_daily_counters" USING btree ("friendship_id","from_user_id","to_user_id","local_date");