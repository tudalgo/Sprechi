CREATE TABLE "queue_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "queues" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "queues" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_members" ADD CONSTRAINT "queue_members_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "queue_members_queue_user_idx" ON "queue_members" USING btree ("queue_id","user_id");--> statement-breakpoint
CREATE INDEX "queue_members_queue_id_idx" ON "queue_members" USING btree ("queue_id");--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "limit";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "disconnect_timeout";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "match_timeout";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "join_message";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "match_found_message";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "timeout_message";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "leave_message";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "leave_room_message";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "text_channel";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "locked";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "auto_lock";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "open_shift";--> statement-breakpoint
ALTER TABLE "queues" DROP COLUMN "close_shift";