ALTER TABLE "template_wrapper" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "template_wrapper" CASCADE;--> statement-breakpoint
DROP INDEX "idx_channel_pref_user_id";--> statement-breakpoint
DROP INDEX "idx_delivery_request_recipient_user_id";--> statement-breakpoint
ALTER TABLE "channel_preference" ALTER COLUMN "contact_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_request" ALTER COLUMN "recipient_contact_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_delivery_request_recipient_contact_id" ON "delivery_request" USING btree ("recipient_contact_id");--> statement-breakpoint
ALTER TABLE "channel_preference" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "channel_preference" DROP COLUMN "quiet_hours_start";--> statement-breakpoint
ALTER TABLE "channel_preference" DROP COLUMN "quiet_hours_end";--> statement-breakpoint
ALTER TABLE "channel_preference" DROP COLUMN "quiet_hours_tz";--> statement-breakpoint
ALTER TABLE "delivery_request" DROP COLUMN "recipient_user_id";--> statement-breakpoint
ALTER TABLE "delivery_request" DROP COLUMN "channels";--> statement-breakpoint
ALTER TABLE "delivery_request" DROP COLUMN "template_name";