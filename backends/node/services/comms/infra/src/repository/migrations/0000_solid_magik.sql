CREATE TABLE "channel_preference" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36),
	"contact_id" varchar(36),
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"quiet_hours_tz" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_attempt" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"recipient_address" varchar(320) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"provider_message_id" varchar(255),
	"error" text,
	"attempt_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_retry_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "delivery_request" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"message_id" varchar(36) NOT NULL,
	"correlation_id" varchar(36) NOT NULL,
	"recipient_user_id" varchar(36),
	"recipient_contact_id" varchar(36),
	"channels" jsonb,
	"template_name" varchar(100),
	"callback_topic" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"thread_id" varchar(36),
	"parent_message_id" varchar(36),
	"sender_user_id" varchar(36),
	"sender_contact_id" varchar(36),
	"sender_service" varchar(50),
	"title" varchar(255),
	"content" text NOT NULL,
	"plain_text_content" text NOT NULL,
	"content_format" varchar(20) DEFAULT 'markdown' NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"urgency" varchar(20) DEFAULT 'normal' NOT NULL,
	"related_entity_id" varchar(36),
	"related_entity_type" varchar(100),
	"metadata" jsonb,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_wrapper" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_pref_user_id" ON "channel_preference" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_pref_contact_id" ON "channel_preference" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_attempt_request_id" ON "delivery_attempt" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_attempt_status_retry" ON "delivery_attempt" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_delivery_request_message_id" ON "delivery_request" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_delivery_request_correlation_id" ON "delivery_request" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_request_recipient_user_id" ON "delivery_request" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_message_thread_id" ON "message" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_message_sender_user_id" ON "message" USING btree ("sender_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_template_name_channel" ON "template_wrapper" USING btree ("name","channel");