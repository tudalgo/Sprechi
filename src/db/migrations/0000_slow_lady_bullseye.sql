CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"welcome_text" text,
	"welcome_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"limit" integer,
	"disconnect_timeout" integer,
	"match_timeout" integer,
	"join_message" text,
	"match_found_message" text,
	"timeout_message" text,
	"leave_message" text,
	"leave_room_message" text,
	"text_channel" text,
	"locked" boolean DEFAULT false NOT NULL,
	"auto_lock" boolean DEFAULT false NOT NULL,
	"open_shift" integer DEFAULT 0 NOT NULL,
	"close_shift" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guilds_name_idx" ON "guilds" USING btree ("name");--> statement-breakpoint
CREATE INDEX "guilds_member_count_idx" ON "guilds" USING btree ("member_count");--> statement-breakpoint
CREATE INDEX "queues_guild_id_idx" ON "queues" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_guild_name_idx" ON "queues" USING btree ("guild_id","name");