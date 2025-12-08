ALTER TABLE "queues" RENAME COLUMN "log_channel_id" TO "private_log_channel_id";--> statement-breakpoint
ALTER TABLE "queues" ADD COLUMN "public_log_channel_id" text;