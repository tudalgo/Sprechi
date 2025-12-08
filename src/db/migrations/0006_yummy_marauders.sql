CREATE TABLE "queue_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queues" ADD COLUMN "schedule_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "queues" ADD COLUMN "schedule_shift_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_schedules" ADD CONSTRAINT "queue_schedules_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_schedules_queue_id_idx" ON "queue_schedules" USING btree ("queue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_schedules_queue_day_idx" ON "queue_schedules" USING btree ("queue_id","day_of_week");