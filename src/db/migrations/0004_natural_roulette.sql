CREATE TABLE "session_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"channel_id" text,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp
);
--> statement-breakpoint
ALTER TABLE "session_students" ADD CONSTRAINT "session_students_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_students_session_id_idx" ON "session_students" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_students_student_id_idx" ON "session_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "session_students_channel_id_idx" ON "session_students" USING btree ("channel_id");--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "students_helped";