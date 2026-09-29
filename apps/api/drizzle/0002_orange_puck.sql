CREATE TABLE "synced_training_preferences" (
	"record_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "synced_training_sessions" ADD COLUMN "feedback" text DEFAULT 'unanswered' NOT NULL;--> statement-breakpoint
ALTER TABLE "synced_training_sessions" ADD COLUMN "end_reason" text;--> statement-breakpoint
ALTER TABLE "synced_training_sessions" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "synced_training_preferences" ADD CONSTRAINT "synced_training_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "synced_training_preferences_user_unique" ON "synced_training_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE FUNCTION pg_temp.training_payload_v2(record_id text, payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE parameters jsonb; result jsonb;
BEGIN
  parameters := CASE payload->>'presetId'
    WHEN 'beginner' THEN '{"contractSeconds":3,"relaxSeconds":3,"repetitions":10}'::jsonb
    WHEN 'standard' THEN '{"contractSeconds":5,"relaxSeconds":5,"repetitions":12}'::jsonb
    ELSE '{"contractSeconds":1,"relaxSeconds":1,"repetitions":16}'::jsonb END;
  result := (payload - 'discomfortReported') || jsonb_build_object('feedback', CASE WHEN payload->>'discomfortReported' = 'true' THEN 'reported' ELSE 'unanswered' END,
    'endReason', CASE WHEN payload->>'isCompleted' = 'true' THEN 'completed' ELSE 'user_stopped' END, 'plan', parameters);
  IF record_id LIKE 'watch-%' AND payload->>'isCompleted' = 'true' AND payload->>'completedRepetitions' = '1'
    AND (payload->>'durationSeconds')::integer = ((parameters->>'contractSeconds')::integer + (parameters->>'relaxSeconds')::integer) * (parameters->>'repetitions')::integer THEN
    result := jsonb_set(result, '{completedRepetitions}', parameters->'repetitions');
  END IF;
  RETURN result;
END $$;
--> statement-breakpoint
UPDATE synced_training_sessions SET
 feedback = CASE WHEN discomfort_reported THEN 'reported' ELSE 'unanswered' END,
 end_reason = CASE WHEN is_completed THEN 'completed' ELSE 'user_stopped' END,
 plan = CASE preset_id
 WHEN 'beginner' THEN '{"contractSeconds":3,"relaxSeconds":3,"repetitions":10}'::jsonb
 WHEN 'standard' THEN '{"contractSeconds":5,"relaxSeconds":5,"repetitions":12}'::jsonb
 ELSE '{"contractSeconds":1,"relaxSeconds":1,"repetitions":16}'::jsonb END;
--> statement-breakpoint
UPDATE synced_training_sessions SET completed_repetitions = (plan->>'repetitions')::integer
 WHERE record_id LIKE 'watch-%' AND is_completed AND completed_repetitions = 1
 AND duration_seconds = ((plan->>'contractSeconds')::integer + (plan->>'relaxSeconds')::integer) * (plan->>'repetitions')::integer;
--> statement-breakpoint
UPDATE data_sync_changes SET payload = pg_temp.training_payload_v2(entity_id, payload)
 WHERE entity_type = 'training_session' AND operation = 'upsert';
--> statement-breakpoint
UPDATE daily_activity_summaries s SET summary = jsonb_set(jsonb_set(summary, '{training,sessionCount}',
 to_jsonb((SELECT COUNT(*) FROM synced_training_sessions t WHERE t.user_id = s.user_id AND t.local_date = s.local_date AND t.deleted_at IS NULL))),
 '{training,completedRepetitions}', to_jsonb(COALESCE((SELECT SUM(completed_repetitions) FROM synced_training_sessions t WHERE t.user_id = s.user_id AND t.local_date = s.local_date AND t.deleted_at IS NULL), 0)));
--> statement-breakpoint
ALTER TABLE synced_training_sessions ALTER COLUMN end_reason SET NOT NULL;
--> statement-breakpoint
ALTER TABLE synced_training_sessions ALTER COLUMN plan SET NOT NULL;
--> statement-breakpoint
ALTER TABLE synced_training_sessions DROP COLUMN discomfort_reported;
