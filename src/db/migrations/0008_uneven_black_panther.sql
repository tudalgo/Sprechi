CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"tu_id" text,
	"moodle_id" text,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_discord_guild_idx" ON "users" USING btree ("discord_id","guild_id");--> statement-breakpoint
CREATE INDEX "users_discord_id_idx" ON "users" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "users_guild_id_idx" ON "users" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "users_tu_id_idx" ON "users" USING btree ("tu_id");--> statement-breakpoint
CREATE INDEX "users_moodle_id_idx" ON "users" USING btree ("moodle_id");