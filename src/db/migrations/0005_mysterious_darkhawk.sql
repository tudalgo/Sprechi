CREATE TYPE "public"."internal_role" AS ENUM('admin', 'tutor', 'verified', 'active_session');--> statement-breakpoint
CREATE TABLE "role_mappings" (
	"guild_id" text NOT NULL,
	"role_type" "internal_role" NOT NULL,
	"role_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_mappings" ADD CONSTRAINT "role_mappings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_mappings_guild_type_idx" ON "role_mappings" USING btree ("guild_id","role_type");--> statement-breakpoint
CREATE INDEX "role_mappings_guild_id_idx" ON "role_mappings" USING btree ("guild_id");