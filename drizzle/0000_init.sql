CREATE TYPE "public"."date_precision" AS ENUM('day', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."entry_category" AS ENUM('family', 'education', 'work', 'travel', 'health', 'hobby', 'celebration', 'other');--> statement-breakpoint
CREATE TYPE "public"."entry_kind" AS ENUM('activity', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."entry_source" AS ENUM('manual', 'text', 'linkedin', 'xing');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('parent', 'partner', 'sibling', 'other');--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "access_codes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "access_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code_hash" varchar(64) NOT NULL,
	"code_hint" varchar(4) NOT NULL,
	"group_id" integer,
	"group_role" "group_role",
	"grants_app_role" "app_role" DEFAULT 'user' NOT NULL,
	"email" varchar(255),
	"is_initial" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"redeemed_by_user_id" text,
	"redeemed_by_email" varchar(255),
	"revoked_at" timestamp with time zone,
	CONSTRAINT "access_codes_group_role_with_group" CHECK (("access_codes"."group_id" IS NULL) = ("access_codes"."group_role" IS NULL)),
	CONSTRAINT "access_codes_grants_something" CHECK ("access_codes"."group_id" IS NOT NULL OR "access_codes"."grants_app_role" = 'admin')
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer NOT NULL,
	"kind" "entry_kind" NOT NULL,
	"category" "entry_category" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"start_precision" date_precision NOT NULL,
	"end_date" date,
	"end_precision" date_precision,
	"span_end" date NOT NULL,
	"location" varchar(255),
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"source_ref" varchar(255),
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_end_after_start" CHECK ("entries"."end_date" IS NULL OR "entries"."end_date" >= "entries"."start_date"),
	CONSTRAINT "entries_end_precision_with_end" CHECK (("entries"."end_date" IS NULL) = ("entries"."end_precision" IS NULL)),
	CONSTRAINT "entries_span_end_after_start" CHECK ("entries"."span_end" >= "entries"."start_date")
);
--> statement-breakpoint
CREATE TABLE "entry_participants" (
	"entry_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"role" varchar(100),
	CONSTRAINT "entry_participants_entry_id_person_id_pk" PRIMARY KEY("entry_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" "group_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "people_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"nickname" varchar(255),
	"birth_date" date,
	"death_date" date,
	"color" varchar(7),
	"notes" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_death_after_birth" CHECK ("people"."death_date" IS NULL OR "people"."birth_date" IS NULL OR "people"."death_date" >= "people"."birth_date")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"related_person_id" integer NOT NULL,
	"type" "relationship_type" NOT NULL,
	"label" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_not_self" CHECK ("relationships"."person_id" <> "relationships"."related_person_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "app_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_participants" ADD CONSTRAINT "entry_participants_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_participants" ADD CONSTRAINT "entry_participants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_related_person_id_people_id_fk" FOREIGN KEY ("related_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_codes_code_hash_unique" ON "access_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "access_codes_single_initial_unique" ON "access_codes" USING btree ("is_initial") WHERE "access_codes"."is_initial" = true;--> statement-breakpoint
CREATE INDEX "entries_group_start_idx" ON "entries" USING btree ("group_id","start_date");--> statement-breakpoint
CREATE INDEX "entries_group_span_end_idx" ON "entries" USING btree ("group_id","span_end");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_group_source_ref_unique" ON "entries" USING btree ("group_id","source","source_ref");--> statement-breakpoint
CREATE INDEX "entry_participants_person_id_idx" ON "entry_participants" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "group_members_user_id_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "people_group_id_idx" ON "people" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_unique" ON "relationships" USING btree ("person_id","related_person_id","type");--> statement-breakpoint
CREATE INDEX "relationships_related_person_id_idx" ON "relationships" USING btree ("related_person_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");