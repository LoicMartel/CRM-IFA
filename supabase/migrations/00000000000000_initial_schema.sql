-- ==========================================================
-- CRM LCA — Initial schema migration
-- Generated from production database catalog
-- Date: 2026-07-27T13:37:27.779Z
-- ==========================================================

BEGIN;

-- ============================================================
-- Extensions
-- ============================================================
-- pg_cron: must be enabled via Supabase dashboard (Extensions page)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
-- pg_stat_statements: pre-installed on Supabase projects
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
-- supabase_vault: pre-installed on Supabase projects
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- ============================================================
-- Enum types
-- ============================================================
CREATE TYPE public.payment_terms AS ENUM ('UP FRONT', 'OPCO', 'CPF', 'autre');

-- ============================================================
-- Tables: public
-- ============================================================
CREATE TABLE public."activities" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_date" timestamptz,
  "is_completed" boolean DEFAULT false,
  "completed_at" timestamptz,
  "team_member_id" uuid,
  "contact_id" uuid,
  "company_id" uuid,
  "lead_id" uuid,
  "opportunity_id" uuid,
  "order_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "task_deadline" date,
  "learner_id" uuid,
  "gcal_event_id" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "activities_type_check" CHECK ((type = ANY (ARRAY['appel'::text, 'email'::text, 'réunion'::text, 'note'::text, 'tâche'::text, 'relance'::text])))
);

CREATE TABLE public."agent_escalation_keywords" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "keyword" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."automation_steps" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "workflow_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "step_type" text NOT NULL,
  "step_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "config" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "automation_steps_workflow_id_slug_key" UNIQUE (workflow_id, slug)
);

CREATE TABLE public."automation_workflows" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "trigger_description" text,
  "api_route" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "config" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "automation_workflows_slug_key" UNIQUE (slug)
);

CREATE TABLE public."billing_documents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "billing_entry_id" uuid NOT NULL,
  "name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_size" integer,
  "file_type" text,
  "document_type" text DEFAULT 'autre'::text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."billing_entries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid,
  "client_name" text NOT NULL,
  "funding_type" text,
  "fiscal_year" text NOT NULL DEFAULT '2025-2026'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "deal_id" uuid,
  "display_order" integer DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE public."billing_months" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "billing_entry_id" uuid NOT NULL,
  "month" date NOT NULL,
  "amount" numeric NOT NULL DEFAULT 0,
  "status" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "notes" text,
  "pennylane_invoice_id" text,
  "deal_id" uuid,
  "invoice_email_sent" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id"),
  CONSTRAINT "billing_months_billing_entry_id_month_key" UNIQUE (billing_entry_id, month)
);

CREATE TABLE public."campaign_recipients" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "email" text NOT NULL,
  "resend_email_id" text,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "sent_at" timestamptz,
  "delivered_at" timestamptz,
  "opened_at" timestamptz,
  "clicked_at" timestamptz,
  "bounced_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "campaign_recipients_campaign_id_contact_id_key" UNIQUE (campaign_id, contact_id),
  CONSTRAINT "campaign_recipients_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'unsubscribed'::text])))
);

CREATE TABLE public."category_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "category" text NOT NULL,
  "team_member_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "category_members_category_team_member_id_key" UNIQUE (category, team_member_id)
);

CREATE TABLE public."comment_attachments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "comment_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_type" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."comment_reactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "comment_id" uuid NOT NULL,
  "team_member_id" uuid NOT NULL,
  "emoji" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "comment_reactions_comment_id_team_member_id_emoji_key" UNIQUE (comment_id, team_member_id, emoji)
);

CREATE TABLE public."companies" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "company_type_id" uuid,
  "phone" text,
  "email" text,
  "address" text,
  "city" text,
  "country" text DEFAULT 'France'::text,
  "website" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "industry" text,
  "employee_count" text,
  "annual_revenue" text,
  "lifecycle_stage" text DEFAULT 'lead'::text,
  "linkedin_url" text,
  "siret" text,
  "owner_id" uuid,
  "primary_contact_id" uuid,
  "opco" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "companies_lifecycle_stage_check" CHECK ((lifecycle_stage = ANY (ARRAY['lead'::text, 'prospect'::text, 'customer'::text, 'partner'::text, 'former_customer'::text])))
);

CREATE TABLE public."company_documents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_size" bigint,
  "file_type" text,
  "document_type" text NOT NULL DEFAULT 'autre'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."company_raisons_sociales" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "siret" text,
  "address" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."raison_sociale_learners" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "raison_sociale_id" uuid NOT NULL,
  "learner_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "raison_sociale_learners_raison_sociale_id_learner_id_key" UNIQUE (raison_sociale_id, learner_id)
);

CREATE TABLE public."company_types" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "company_types_name_key" UNIQUE (name)
);

CREATE TABLE public."contact_list_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "list_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "added_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "contact_list_members_list_id_contact_id_key" UNIQUE (list_id, contact_id)
);

CREATE TABLE public."contact_lists" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."contacts" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "position" text,
  "company_id" uuid,
  "is_client" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "lifecycle_stage" text DEFAULT 'lead'::text,
  "lead_status" text,
  "last_contacted_at" timestamptz,
  "linkedin_url" text,
  "owner_id" uuid,
  "is_qualified" boolean DEFAULT false,
  "is_learner" boolean DEFAULT false,
  "contact_type" text,
  "source_id" uuid,
  "was_lead_marketing" boolean DEFAULT false,
  PRIMARY KEY ("id"),
  CONSTRAINT "contacts_contact_type_check" CHECK ((contact_type = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
  CONSTRAINT "contacts_lead_status_check" CHECK ((lead_status = ANY (ARRAY['lead'::text, 'contacted'::text, 'booked'::text, 'not_booked'::text, 'rdv_done'::text, 'signed'::text, 'Intéressé'::text, 'new_not_contacted'::text, 'not_interested'::text, 'cancelled'::text, 'no_show'::text]))),
  CONSTRAINT "contacts_lifecycle_stage_check" CHECK ((lifecycle_stage = ANY (ARRAY['prospect'::text, 'customer'::text, 'former_customer'::text, 'lead_marketing'::text])))
);

CREATE TABLE public."conversations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "contact_id" uuid,
  "channel" text NOT NULL,
  "account_id" text,
  "external_chat_id" text,
  "subject" text,
  "category" text,
  "intent" text,
  "agent_status" text NOT NULL DEFAULT 'human'::text,
  "escalation_reason" text,
  "agent_last_acted_at" timestamptz,
  "agent_turn_count" integer NOT NULL DEFAULT 0,
  "unread" boolean NOT NULL DEFAULT true,
  "last_message_at" timestamptz NOT NULL DEFAULT now(),
  "owner_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "interest_score" integer,
  "score_reason" text,
  "triage_folder" text,
  "triage_action_required" boolean NOT NULL DEFAULT false,
  "triage_assignee" text,
  "triage_assignee_source" text NOT NULL DEFAULT 'ai'::text,
  "triage_folder_reason" text,
  "triage_folder_source" text NOT NULL DEFAULT 'ai'::text,
  PRIMARY KEY ("id"),
  CONSTRAINT "conversations_agent_status_check" CHECK ((agent_status = ANY (ARRAY['active'::text, 'human'::text, 'escalated'::text, 'booked'::text, 'dormant'::text]))),
  CONSTRAINT "conversations_category_check" CHECK (((category IS NULL) OR (category = ANY (ARRAY['a'::text, 'b'::text, 'c'::text])))),
  CONSTRAINT "conversations_channel_check" CHECK ((channel = ANY (ARRAY['linkedin'::text, 'email'::text, 'whatsapp'::text, 'instagram'::text, 'messenger'::text, 'sms'::text, 'web_form'::text]))),
  CONSTRAINT "conversations_escalation_reason_check" CHECK (((escalation_reason IS NULL) OR (escalation_reason = ANY (ARRAY['high_value'::text, 'explicit_human'::text, 'low_confidence'::text, 'keyword'::text, 'off_script'::text, 'negative'::text, 'existing_contact'::text, 'linkedin'::text])))),
  CONSTRAINT "conversations_intent_check" CHECK (((intent IS NULL) OR (intent = ANY (ARRAY['rdv'::text, 'devis'::text, 'question'::text, 'spam'::text, 'autre'::text]))))
);

CREATE TABLE public."deal_documents" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "deal_id" uuid NOT NULL,
  "name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_size" integer,
  "file_type" text,
  "document_type" text NOT NULL DEFAULT 'autre'::text,
  "uploaded_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "deal_documents_document_type_check" CHECK ((document_type = ANY (ARRAY['devis'::text, 'convention'::text, 'programme'::text, 'convocation'::text, 'facture'::text, 'emargements'::text, 'bilan_initial'::text, 'bilan_intermediaire'::text, 'bilan_final'::text, 'autre'::text])))
);

CREATE TABLE public."deals" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "contact_id" uuid,
  "company_id" uuid,
  "owner_id" uuid,
  "source_id" uuid,
  "stage" text NOT NULL DEFAULT 'opportunities'::text,
  "amount" numeric(12,2),
  "training_days" numeric(8,3),
  "probability" integer DEFAULT 10,
  "expected_close_date" date,
  "close_date" date,
  "lost_reason" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_invoiced" boolean DEFAULT false,
  "is_paid" boolean DEFAULT false,
  "training_days_presentiel" numeric,
  "training_days_distanciel" numeric,
  "pennylane_quote_id" text,
  "pennylane_invoice_id" text,
  "stage_changed_at" timestamptz DEFAULT now(),
  "convention_signed_at" timestamptz,
  "quote_scheduled_send_at" timestamptz,
  "convention_status" text,
  "firma_devis_signing_id" text,
  "firma_convention_signing_id" text,
  "convention_form" jsonb,
  "quote_lines" jsonb,
  "quote_subject" text,
  "quote_pdf_description" text,
  "quote_number" text,
  "wf009_suggested_trainer_id" uuid,
  "wf009_suggestion_correct" boolean,
  "wf009_feedback" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "deals_probability_check" CHECK (((probability >= 0) AND (probability <= 100))),
  CONSTRAINT "deals_stage_check" CHECK ((stage = ANY (ARRAY['opportunities'::text, 'quote_to_send'::text, 'quote_to_validate'::text, 'quote_sent'::text, 'opco_deposit'::text, 'quote_signed'::text, 'ordered'::text, 'closed_won'::text, 'closed_lost'::text])))
);

CREATE TABLE public."email_log" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "recipient" text NOT NULL,
  "subject" text,
  "body" text,
  "transporter" text NOT NULL DEFAULT 'resend'::text,
  "status" text NOT NULL,
  "error" text,
  "has_attachments" boolean NOT NULL DEFAULT false,
  "attachment_count" integer NOT NULL DEFAULT 0,
  "related_entity_type" text,
  "related_entity_id" text,
  "source" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "email_log_status_check" CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text]))),
  CONSTRAINT "email_log_transporter_check" CHECK ((transporter = ANY (ARRAY['resend'::text, 'ionos'::text, 'pennylane'::text, 'firma'::text]))),
  CONSTRAINT "email_log_transporter_chk" CHECK ((transporter = ANY (ARRAY['resend'::text, 'ionos'::text, 'pennylane'::text, 'firma'::text, 'unipile'::text])))
);

CREATE TABLE public."engagements" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_date" timestamptz,
  "call_result" text,
  "call_outcome" text,
  "contact_id" uuid,
  "company_id" uuid,
  "lead_id" uuid,
  "deal_id" uuid,
  "team_member_id" uuid,
  "is_completed" boolean DEFAULT false,
  "completed_at" timestamptz,
  "task_deadline" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "direction" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source" text,
  "source_workflow" text,
  "external_id" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "engagements_call_outcome_check" CHECK ((call_outcome = ANY (ARRAY['not_booked'::text, 'booked'::text]))),
  CONSTRAINT "engagements_call_result_check" CHECK ((call_result = ANY (ARRAY['no_answer'::text, 'voicemail'::text, 'contacted'::text, 'not_interested'::text]))),
  CONSTRAINT "engagements_direction_check" CHECK (((direction IS NULL) OR (direction = ANY (ARRAY['in'::text, 'out'::text, 'internal'::text])))),
  CONSTRAINT "engagements_type_check" CHECK ((type = ANY (ARRAY['appel'::text, 'email'::text, 'reunion'::text, 'note'::text, 'tache'::text, 'relance'::text, 'sms'::text, 'whatsapp'::text, 'system'::text])))
);

CREATE TABLE public."expense_categories" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "parent_category" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "expense_categories_name_key" UNIQUE (name)
);

CREATE TABLE public."expenses" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "category_id" uuid,
  "tool_name" text,
  "department" text,
  "month" date NOT NULL,
  "amount" numeric(10,2) DEFAULT 0,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "expenses_department_check" CHECK ((department = ANY (ARRAY['ADMIN'::text, 'MARKETING'::text, 'PÉDAGOGIE'::text, 'VENTE'::text, 'RH'::text])))
);

CREATE TABLE public."inbox_accounts" (
  "account_id" text NOT NULL,
  "channel" text,
  "mode" text NOT NULL DEFAULT 'classify'::text,
  "owner_id" uuid,
  "reply_mode" text NOT NULL DEFAULT 'off'::text,
  "display_name" text,
  "signature" text,
  "voice_profile" text,
  "booking_link" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "auto_file" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("account_id"),
  CONSTRAINT "inbox_accounts_channel_check" CHECK (((channel IS NULL) OR (channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'linkedin'::text, 'instagram'::text, 'messenger'::text])))),
  CONSTRAINT "inbox_accounts_mode_check" CHECK ((mode = ANY (ARRAY['agent'::text, 'copilot'::text, 'classify'::text]))),
  CONSTRAINT "inbox_accounts_reply_mode_check" CHECK ((reply_mode = ANY (ARRAY['off'::text, 'draft'::text, 'auto'::text])))
);

CREATE TABLE public."invoice_documents" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "invoice_id" uuid NOT NULL,
  "name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_size" integer,
  "file_type" text,
  "document_type" text NOT NULL DEFAULT 'facture'::text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "invoice_documents_document_type_check" CHECK ((document_type = ANY (ARRAY['facture'::text, 'avoir'::text, 'relance'::text, 'pennylane'::text, 'autre'::text])))
);

CREATE TABLE public."invoices" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "company_id" uuid,
  "order_id" uuid,
  "client_name" text NOT NULL,
  "funding_type" text,
  "month" date NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "is_paid" boolean DEFAULT false,
  "paid_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "deal_id" uuid,
  "status" text DEFAULT 'facturable'::text,
  "invoice_name" text,
  "due_date" date,
  PRIMARY KEY ("id"),
  CONSTRAINT "invoices_funding_type_check" CHECK ((funding_type = ANY (ARRAY['UP FRONT'::text, 'OPCO'::text, 'CPF'::text, 'autre'::text]))),
  CONSTRAINT "invoices_status_check" CHECK ((status = ANY (ARRAY['facturable'::text, 'facture'::text, 'paye'::text])))
);

CREATE TABLE public."lead_sources" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lead_sources_name_key" UNIQUE (name)
);

CREATE TABLE public."leads" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "contact_id" uuid,
  "company_id" uuid,
  "company_type_id" uuid,
  "sales_id" uuid,
  "source_id" uuid,
  "month_year" date,
  "r1_status" text DEFAULT 'pending'::text,
  "r2_status" text DEFAULT 'pending'::text,
  "r3_status" text DEFAULT 'pending'::text,
  "r3_2_status" text DEFAULT 'pending'::text,
  "follow_up" text,
  "status" text DEFAULT 'nouveau'::text,
  "synced_to_crm" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "leads_r1_status_check" CHECK ((r1_status = ANY (ARRAY['pending'::text, 'done'::text, 'skipped'::text]))),
  CONSTRAINT "leads_r2_status_check" CHECK ((r2_status = ANY (ARRAY['pending'::text, 'done'::text, 'skipped'::text]))),
  CONSTRAINT "leads_r3_2_status_check" CHECK ((r3_2_status = ANY (ARRAY['pending'::text, 'done'::text, 'skipped'::text]))),
  CONSTRAINT "leads_r3_status_check" CHECK ((r3_status = ANY (ARRAY['pending'::text, 'done'::text, 'skipped'::text]))),
  CONSTRAINT "leads_status_check" CHECK ((status = ANY (ARRAY['nouveau'::text, 'en_cours'::text, 'r_plus_booked'::text, 'gagné'::text, 'perdu'::text])))
);

CREATE TABLE public."learners" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "position" text,
  "company_id" uuid,
  "status" text DEFAULT 'actuel'::text,
  "program_id" uuid,
  "training_type_id" uuid,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "expert_id" uuid,
  "contact_id" uuid,
  PRIMARY KEY ("id"),
  CONSTRAINT "learners_status_check" CHECK ((status = ANY (ARRAY['ancien'::text, 'actuel'::text, 'futur'::text])))
);

CREATE TABLE public."lms_answer_options" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "question_id" uuid NOT NULL,
  "option_text" text NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false,
  "display_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_coach_conversations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "learner_profile_id" uuid NOT NULL,
  "title" text,
  "current_step_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_coach_messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "tokens_used" integer,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_coach_messages_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);

CREATE TABLE public."lms_content_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL,
  "title" text NOT NULL,
  "content_type" text NOT NULL,
  "storage_path" text,
  "external_url" text,
  "scorm_package_path" text,
  "scorm_entry_point" text,
  "duration_seconds" integer,
  "file_size_bytes" bigint,
  "mime_type" text,
  "thumbnail_url" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "description" text,
  "iframe_url" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_content_items_content_type_check" CHECK ((content_type = ANY (ARRAY['video'::text, 'audio'::text, 'pdf'::text, 'text'::text, 'embed'::text, 'scorm'::text, 'image'::text, 'quiz_inline'::text, 'survey'::text, 'file_upload'::text])))
);

CREATE TABLE public."lms_content_views" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "learner_profile_id" uuid NOT NULL,
  "content_item_id" uuid NOT NULL,
  "started_at" timestamptz DEFAULT now(),
  "ended_at" timestamptz,
  "duration_seconds" integer,
  "completed" boolean DEFAULT false,
  "scorm_data" jsonb,
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_enrollments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "learner_profile_id" uuid NOT NULL,
  "parcours_id" uuid NOT NULL,
  "enrolled_at" timestamptz DEFAULT now(),
  "enrolled_by" uuid,
  "status" text NOT NULL DEFAULT 'active'::text,
  "completed_at" timestamptz,
  "current_step_number" integer DEFAULT 1,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_enrollments_learner_profile_id_parcours_id_key" UNIQUE (learner_profile_id, parcours_id),
  CONSTRAINT "lms_enrollments_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE public."lms_enterprise_group_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL,
  "learner_profile_id" uuid NOT NULL,
  "added_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_enterprise_group_members_group_id_learner_profile_id_key" UNIQUE (group_id, learner_profile_id)
);

CREATE TABLE public."lms_enterprise_groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_enterprise_managers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "role" text NOT NULL DEFAULT 'manager'::text,
  "managed_group_ids" uuid[],
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_enterprise_managers_role_check" CHECK ((role = ANY (ARRAY['dirigeant'::text, 'manager'::text])))
);

CREATE TABLE public."lms_evaluation_attempts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "learner_profile_id" uuid NOT NULL,
  "evaluation_id" uuid NOT NULL,
  "attempt_number" integer NOT NULL DEFAULT 1,
  "started_at" timestamptz DEFAULT now(),
  "submitted_at" timestamptz,
  "score_points" integer,
  "score_percentage" integer,
  "passed" boolean,
  "time_spent_seconds" integer,
  "answers" jsonb,
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_evaluations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "passing_score" integer NOT NULL DEFAULT 70,
  "max_attempts" integer DEFAULT 3,
  "time_limit_minutes" integer,
  "shuffle_questions" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_forum_categories" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0,
  "step_id" uuid,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_forum_categories_slug_key" UNIQUE (slug)
);

CREATE TABLE public."lms_forum_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL,
  "author_profile_id" uuid,
  "author_team_member_id" uuid,
  "body" text NOT NULL,
  "is_answer" boolean DEFAULT false,
  "parent_comment_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_forum_posts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "category_id" uuid NOT NULL,
  "author_profile_id" uuid,
  "author_team_member_id" uuid,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_pinned" boolean DEFAULT false,
  "is_resolved" boolean DEFAULT false,
  "view_count" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."lms_forum_reactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "post_id" uuid,
  "comment_id" uuid,
  "learner_profile_id" uuid NOT NULL,
  "reaction_type" text NOT NULL DEFAULT 'like'::text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_forum_reactions_comment_id_learner_profile_id_reaction__key" UNIQUE (comment_id, learner_profile_id, reaction_type),
  CONSTRAINT "lms_forum_reactions_post_id_learner_profile_id_reaction_typ_key" UNIQUE (post_id, learner_profile_id, reaction_type),
  CONSTRAINT "lms_forum_reactions_reaction_type_check" CHECK ((reaction_type = ANY (ARRAY['like'::text, 'helpful'::text, 'insightful'::text])))
);

CREATE TABLE public."lms_learner_profiles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id" uuid NOT NULL,
  "learner_id" uuid,
  "company_id" uuid,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "avatar_url" text,
  "preferred_language" text DEFAULT 'fr'::text,
  "onboarding_completed" boolean DEFAULT false,
  "last_login_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_learner_profiles_auth_user_id_key" UNIQUE (auth_user_id),
  CONSTRAINT "lms_learner_profiles_email_key" UNIQUE (email)
);

CREATE TABLE public."lms_module_progress" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "step_progress_id" uuid NOT NULL,
  "module_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'not_started'::text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "time_spent_seconds" integer DEFAULT 0,
  "last_content_item_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_module_progress_step_progress_id_module_id_key" UNIQUE (step_progress_id, module_id),
  CONSTRAINT "lms_module_progress_status_check" CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text])))
);

CREATE TABLE public."lms_modules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "step_id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "module_type" text NOT NULL DEFAULT 'content'::text,
  "display_order" integer NOT NULL DEFAULT 0,
  "estimated_duration_minutes" integer,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_modules_step_id_slug_key" UNIQUE (step_id, slug),
  CONSTRAINT "lms_modules_module_type_check" CHECK ((module_type = ANY (ARRAY['content'::text, 'evaluation'::text, 'activity'::text])))
);

CREATE TABLE public."lms_notifications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "learner_profile_id" uuid,
  "enterprise_manager_id" uuid,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "link" text,
  "is_read" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_notifications_type_check" CHECK ((type = ANY (ARRAY['new_content'::text, 'reminder'::text, 'evaluation_result'::text, 'forum_reply'::text, 'achievement'::text, 'admin_message'::text])))
);

CREATE TABLE public."lms_parcours" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "cover_image_url" text,
  "is_active" boolean DEFAULT true,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_parcours_slug_key" UNIQUE (slug)
);

CREATE TABLE public."lms_questions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "evaluation_id" uuid NOT NULL,
  "question_text" text NOT NULL,
  "question_type" text NOT NULL,
  "explanation" text,
  "points" integer NOT NULL DEFAULT 1,
  "display_order" integer NOT NULL DEFAULT 0,
  "media_url" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_questions_question_type_check" CHECK ((question_type = ANY (ARRAY['single_choice'::text, 'multiple_choice'::text, 'true_false'::text, 'open_text'::text, 'ranking'::text])))
);

CREATE TABLE public."lms_step_progress" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" uuid NOT NULL,
  "step_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'locked'::text,
  "unlocked_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "best_eval_score" integer,
  "total_time_seconds" integer DEFAULT 0,
  "manually_unlocked" boolean DEFAULT false,
  "unlocked_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_step_progress_enrollment_id_step_id_key" UNIQUE (enrollment_id, step_id),
  CONSTRAINT "lms_step_progress_status_check" CHECK ((status = ANY (ARRAY['locked'::text, 'unlocked'::text, 'in_progress'::text, 'completed'::text])))
);

CREATE TABLE public."lms_steps" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "parcours_id" uuid NOT NULL,
  "step_number" integer NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "description" text,
  "cover_image_url" text,
  "unlock_min_score" integer DEFAULT 70,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lms_steps_parcours_id_step_number_key" UNIQUE (parcours_id, step_number),
  CONSTRAINT "lms_steps_step_number_check" CHECK (((step_number >= 1) AND (step_number <= 10)))
);

CREATE TABLE public."marketing_campaigns" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "from_name" text NOT NULL DEFAULT 'La Closing Académie'::text,
  "from_email" text NOT NULL DEFAULT 'contact@closing-academie.com'::text,
  "html_content" text NOT NULL DEFAULT ''::text,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "list_id" uuid,
  "sent_at" timestamptz,
  "sent_count" integer DEFAULT 0,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "marketing_campaigns_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'sending'::text, 'sent'::text])))
);

CREATE TABLE public."marketing_expense_documents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "expense_id" uuid NOT NULL,
  "name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_size" bigint,
  "file_type" text,
  "document_type" text DEFAULT 'autre'::text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."marketing_expenses" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "provider_name" text NOT NULL,
  "amount" numeric(12,2) NOT NULL DEFAULT 0,
  "description" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "rdv_done" integer NOT NULL DEFAULT 0,
  "revenue" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE public."marketing_providers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "marketing_providers_name_key" UNIQUE (name)
);

CREATE TABLE public."marketing_weekly_stats" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "expenses" numeric(12,2) DEFAULT 0,
  "page_visits" integer DEFAULT 0,
  "leads" integer DEFAULT 0,
  "r0_booked" integer DEFAULT 0,
  "r0_done" integer DEFAULT 0,
  "r1_booked" integer DEFAULT 0,
  "r1_done" integer DEFAULT 0,
  "rdv_booked_inbound" integer DEFAULT 0,
  "rdv_done_inbound" integer DEFAULT 0,
  "sales" integer DEFAULT 0,
  "revenue" numeric(12,2) DEFAULT 0,
  "comment" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "marketing_weekly_stats_provider_id_period_start_key" UNIQUE (provider_id, period_start)
);

CREATE TABLE public."meeting_contacts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "meeting_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "meeting_contacts_meeting_id_contact_id_key" UNIQUE (meeting_id, contact_id)
);

CREATE TABLE public."meeting_managers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "meeting_id" uuid NOT NULL,
  "team_member_id" uuid NOT NULL,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "meeting_managers_meeting_id_team_member_id_key" UNIQUE (meeting_id, team_member_id)
);

CREATE TABLE public."meetings" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "lead_id" uuid,
  "contact_id" uuid,
  "company_id" uuid,
  "assigned_to" uuid,
  "meeting_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'booked'::text,
  "scheduled_at" timestamptz NOT NULL,
  "duration_minutes" integer DEFAULT 60,
  "location" text,
  "meeting_mode" text DEFAULT 'visio'::text,
  "notes" text,
  "outcome" text,
  "next_step" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "gcal_event_ids" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id"),
  CONSTRAINT "meetings_meeting_mode_check" CHECK ((meeting_mode = ANY (ARRAY['visio'::text, 'phone'::text, 'in_person'::text]))),
  CONSTRAINT "meetings_meeting_type_check" CHECK ((meeting_type = ANY (ARRAY['R0'::text, 'R1'::text, 'R2'::text, 'R3'::text, 'R4'::text, 'R0+R1'::text]))),
  CONSTRAINT "meetings_status_check" CHECK ((status = ANY (ARRAY['booked'::text, 'done'::text, 'no_show'::text, 'cancelled'::text])))
);

CREATE TABLE public."messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL,
  "direction" text NOT NULL,
  "sent_by" text NOT NULL DEFAULT 'lead'::text,
  "sender_name" text,
  "sender_handle" text,
  "body" text NOT NULL DEFAULT ''::text,
  "external_message_id" text,
  "is_draft" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'received'::text,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "messages_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
  CONSTRAINT "messages_sent_by_check" CHECK ((sent_by = ANY (ARRAY['lead'::text, 'agent'::text, 'human'::text]))),
  CONSTRAINT "messages_status_check" CHECK ((status = ANY (ARRAY['received'::text, 'draft'::text, 'validated'::text, 'sent'::text, 'failed'::text])))
);

CREATE TABLE public."monthly_charges" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "month" text NOT NULL,
  "charges_ttc" numeric DEFAULT 0,
  "tresorerie" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "rh_previsionnel" numeric DEFAULT 0,
  "charges_diverses" numeric DEFAULT 0,
  "rbst_dettes" numeric DEFAULT 0,
  "pret_pge" numeric DEFAULT 0,
  "pret_boost_bpi" numeric DEFAULT 0,
  "pret_tresorerie" numeric DEFAULT 0,
  "encaisse_ttc" numeric DEFAULT 0,
  "facture_ht" numeric DEFAULT 0,
  "encaisse_ht" numeric DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "monthly_charges_month_key" UNIQUE (month)
);

CREATE TABLE public."monthly_finances" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "month" date NOT NULL,
  "orders_target" numeric(12,2),
  "orders_actual" numeric(12,2) DEFAULT 0,
  "delivered_amount" numeric(12,2) DEFAULT 0,
  "billable_delivery" numeric(12,2) DEFAULT 0,
  "billable_adv" numeric(12,2) DEFAULT 0,
  "invoiced_amount" numeric(12,2) DEFAULT 0,
  "collected_amount" numeric(12,2) DEFAULT 0,
  "client_receivables" numeric(12,2) DEFAULT 0,
  "disbursed_amount" numeric(12,2) DEFAULT 0,
  "loan_repayment" numeric(10,2) DEFAULT 3553.00,
  "charges_amount" numeric(12,2) DEFAULT 0,
  "cash_flow" numeric(12,2) DEFAULT 0,
  "treasury" numeric(12,2) DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "monthly_finances_month_key" UNIQUE (month)
);

CREATE TABLE public."notifications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id" uuid NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "link_url" text,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "actor_id" uuid,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."nurture_enrollments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "sequence_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "meeting_id" uuid,
  "status" text NOT NULL DEFAULT 'active'::text,
  "current_step" integer NOT NULL DEFAULT 0,
  "next_send_at" timestamptz,
  "enrolled_at" timestamptz NOT NULL DEFAULT now(),
  "last_sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "nurture_enrollments_status_chk" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'exited_booked'::text, 'exited_replied'::text, 'cancelled'::text])))
);

CREATE TABLE public."nurture_sequences" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "trigger" text NOT NULL,
  "anchor" text NOT NULL DEFAULT 'enrollment'::text,
  "is_active" boolean NOT NULL DEFAULT true,
  "from_account_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "nurture_sequences_slug_key" UNIQUE (slug),
  CONSTRAINT "nurture_sequences_anchor_chk" CHECK ((anchor = ANY (ARRAY['enrollment'::text, 'meeting'::text]))),
  CONSTRAINT "nurture_sequences_trigger_chk" CHECK ((trigger = ANY (ARRAY['optin_vsl'::text, 'no_show_r0'::text, 'no_show_r1'::text, 'booked'::text])))
);

CREATE TABLE public."nurture_steps" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "sequence_id" uuid NOT NULL,
  "step_order" integer NOT NULL,
  "delay_hours" integer NOT NULL,
  "channel" text NOT NULL DEFAULT 'email'::text,
  "subject" text,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "nurture_steps_sequence_id_step_order_key" UNIQUE (sequence_id, step_order),
  CONSTRAINT "nurture_steps_channel_chk" CHECK ((channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'sms'::text]))),
  CONSTRAINT "nurture_steps_delay_chk" CHECK ((delay_hours >= 0)),
  CONSTRAINT "nurture_steps_order_chk" CHECK ((step_order >= 1))
);

CREATE TABLE public."opportunities" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "contact_id" uuid,
  "company_id" uuid,
  "sales_id" uuid,
  "amount" numeric(12,2),
  "training_days" numeric(8,3),
  "stage" text DEFAULT 'opportunité'::text,
  "is_planned" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "opportunities_stage_check" CHECK ((stage = ANY (ARRAY['opportunité'::text, 'pipe'::text, 'gagné'::text, 'perdu'::text])))
);

CREATE TABLE public."post_attachments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_type" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."post_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."post_project_tags" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "post_project_tags_name_key" UNIQUE (name)
);

CREATE TABLE public."post_reactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL,
  "team_member_id" uuid NOT NULL,
  "emoji" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "post_reactions_post_id_team_member_id_emoji_key" UNIQUE (post_id, team_member_id, emoji)
);

CREATE TABLE public."posts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "author_id" uuid NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "category" text NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "pinned" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "project_tag_id" uuid,
  "banner" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "posts_category_check" CHECK ((category = ANY (ARRAY['annonces_generales'::text, 'lead_gen'::text, 'commercial'::text, 'pedagogie'::text, 'pilotage_lca'::text, 'admin'::text, 'projets_en_cours'::text, 'veille_reglementaire'::text, 'veille_metiers'::text, 'veille_pedagogie'::text]))),
  CONSTRAINT "posts_entity_type_check" CHECK ((entity_type = ANY (ARRAY['contact'::text, 'company'::text, 'deal'::text, 'order'::text])))
);

CREATE TABLE public."quotations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "deal_id" uuid,
  "company_name" text,
  "contact_name" text,
  "nb_learners" integer NOT NULL DEFAULT 1,
  "months" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "nb_rise_up" integer NOT NULL DEFAULT 0,
  "tjm_lca" numeric NOT NULL DEFAULT 2200,
  "base_coeff" numeric NOT NULL DEFAULT 1.00,
  "travel_coeff" numeric NOT NULL DEFAULT 0.25,
  "prep_coeff" numeric NOT NULL DEFAULT 0.25,
  "cost_per_day_presentiel" numeric NOT NULL DEFAULT 350,
  "rise_up_cost_per_license" numeric NOT NULL DEFAULT 690,
  "vt_duration_hours" numeric NOT NULL DEFAULT 1,
  "presentiel_hours_per_day" numeric NOT NULL DEFAULT 8,
  "total_ht" numeric,
  "total_presentiel_days" numeric,
  "total_vt_sessions" numeric,
  "total_hours_formation" numeric,
  "total_hours_intervention" numeric,
  "total_hours_mobilisation" numeric,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "company_id" uuid,
  "contact_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE public."quote_sequences" (
  "year" integer NOT NULL,
  "last_value" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("year")
);

CREATE TABLE public."resources" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" text NOT NULL,
  "subcategory" text,
  "file_path" text NOT NULL,
  "file_size" bigint,
  "file_type" text,
  "description" text,
  "uploaded_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."sales_targets" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "month" date NOT NULL,
  "target_amount" numeric(12,2) NOT NULL,
  "actual_amount" numeric(12,2) DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "sales_targets_month_key" UNIQUE (month)
);

CREATE TABLE public."service_plan_companies" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "service_plan_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "deal_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE public."service_plan_learners" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "service_plan_id" uuid,
  "learner_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "service_plan_learners_service_plan_id_learner_id_key" UNIQUE (service_plan_id, learner_id)
);

CREATE TABLE public."service_plans" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "company_id" uuid NOT NULL,
  "manager_name" text,
  "manager_phone" text,
  "manager_email" text,
  "program_id" uuid,
  "training_type_id" uuid,
  "budget" numeric(12,2),
  "budget_remaining" numeric(12,2),
  "start_date" date,
  "end_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "format" text DEFAULT 'individuel'::text,
  "mode" text DEFAULT 'distanciel'::text,
  "vt_planned" integer DEFAULT 0,
  "days_planned" integer DEFAULT 0,
  "deal_id" uuid,
  "hourly_rate" numeric DEFAULT 0,
  "plan_type" text NOT NULL DEFAULT 'intra'::text,
  "deal_ids" text[] DEFAULT '{}'::text[],
  "plan_name" text,
  "primary_trainer_id" uuid,
  PRIMARY KEY ("id"),
  CONSTRAINT "service_plans_format_check" CHECK ((format = ANY (ARRAY['individuel'::text, 'collectif'::text, 'individuel_collectif'::text]))),
  CONSTRAINT "service_plans_mode_check" CHECK ((mode = ANY (ARRAY['presentiel'::text, 'distanciel'::text, 'mixte'::text])))
);

CREATE TABLE public."session_themes" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "is_billable" boolean DEFAULT true,
  "delivery_mode" text NOT NULL,
  "default_hours" numeric(5,2),
  "default_rate" numeric(8,2) DEFAULT 250.00,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "session_themes_name_key" UNIQUE (name),
  CONSTRAINT "session_themes_delivery_mode_check" CHECK ((delivery_mode = ANY (ARRAY['présentiel'::text, 'distanciel'::text])))
);

CREATE TABLE public."sessions" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "week_number" text,
  "session_date" date NOT NULL,
  "company_id" uuid,
  "theme_id" uuid,
  "delivery_mode" text NOT NULL,
  "is_billable" boolean DEFAULT true,
  "attendee_names" text,
  "session_label" text,
  "hours_planned" numeric(5,2),
  "hours_delivered" numeric(5,2),
  "learners_planned" integer,
  "learners_delivered" integer,
  "hourly_rate" numeric(8,2) DEFAULT 250.00,
  "non_billable_amount" numeric(10,2) DEFAULT 0,
  "billable_amount" numeric(10,2) DEFAULT 0,
  "trainer_id" uuid,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "sessions_delivery_mode_check" CHECK ((delivery_mode = ANY (ARRAY['présentiel'::text, 'distanciel'::text])))
);

CREATE TABLE public."team_members" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "auth_user_id" uuid,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "role" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "roles" text[] DEFAULT '{}'::text[],
  "google_calendar_id" text,
  "zoom_link" text,
  "google_calendar_id_presentiel" text,
  "slack_user_id" text,
  "availability" text,
  "notes" text,
  "google_calendar_id_commercial" text,
  "google_calendar_id_tasks" text,
  "avatar_url" text,
  "permissions" jsonb DEFAULT '{}'::jsonb,
  "expertises" text[] DEFAULT '{}'::text[],
  "city" text,
  "region" text,
  "tjm" numeric(10,2),
  "days_per_week" numeric(3,1),
  "preferred_days" text[] DEFAULT '{}'::text[],
  "expert_status" text DEFAULT 'active'::text,
  "mobility" text DEFAULT 'Toute la France'::text,
  "email_signature" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "team_members_email_key" UNIQUE (email),
  CONSTRAINT "team_members_expert_status_check" CHECK ((expert_status = ANY (ARRAY['active'::text, 'pending'::text, 'inactive'::text]))),
  CONSTRAINT "team_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'sales'::text, 'trainer'::text, 'account_manager'::text, 'finance'::text])))
);

CREATE TABLE public."training_programs" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "training_programs_name_key" UNIQUE (name)
);

CREATE TABLE public."training_session_learners" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "training_session_id" uuid NOT NULL,
  "learner_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "training_session_learners_training_session_id_learner_id_key" UNIQUE (training_session_id, learner_id)
);

CREATE TABLE public."training_sessions" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "service_plan_id" uuid NOT NULL,
  "session_type" text NOT NULL,
  "session_date" date NOT NULL,
  "status" text NOT NULL DEFAULT 'planned'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "duration_hours" numeric DEFAULT 1,
  "trainers" text[] DEFAULT '{}'::text[],
  "is_billable" boolean DEFAULT true,
  "gcal_event_id" text,
  "session_time" time DEFAULT '09:00:00'::time without time zone,
  "session_location" text,
  "gcal_event_ids" jsonb DEFAULT '{}'::jsonb,
  "hourly_rate" numeric,
  PRIMARY KEY ("id"),
  CONSTRAINT "training_sessions_session_type_check" CHECK ((session_type = ANY (ARRAY['vt'::text, 'journee'::text]))),
  CONSTRAINT "training_sessions_status_check" CHECK ((status = ANY (ARRAY['planned'::text, 'done'::text, 'cancelled'::text, 'no_show'::text])))
);

CREATE TABLE public."training_types" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "training_types_name_key" UNIQUE (name)
);

-- ============================================================
-- Foreign keys: public
-- ============================================================
ALTER TABLE public."activities" ADD CONSTRAINT "activities_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
ALTER TABLE public."activities" ADD CONSTRAINT "activities_learner_id_fkey" FOREIGN KEY (learner_id) REFERENCES learners(id);
ALTER TABLE public."activities" ADD CONSTRAINT "activities_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES opportunities(id);
ALTER TABLE public."activities" ADD CONSTRAINT "activities_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES team_members(id);
ALTER TABLE public."automation_steps" ADD CONSTRAINT "automation_steps_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE;
ALTER TABLE public."billing_documents" ADD CONSTRAINT "billing_documents_billing_entry_id_fkey" FOREIGN KEY (billing_entry_id) REFERENCES billing_entries(id) ON DELETE CASCADE;
ALTER TABLE public."billing_entries" ADD CONSTRAINT "billing_entries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE public."billing_entries" ADD CONSTRAINT "billing_entries_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public."billing_months" ADD CONSTRAINT "billing_months_billing_entry_id_fkey" FOREIGN KEY (billing_entry_id) REFERENCES billing_entries(id) ON DELETE CASCADE;
ALTER TABLE public."billing_months" ADD CONSTRAINT "billing_months_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public."campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public."campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."category_members" ADD CONSTRAINT "category_members_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public."comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE;
ALTER TABLE public."comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE;
ALTER TABLE public."comment_reactions" ADD CONSTRAINT "comment_reactions_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public."companies" ADD CONSTRAINT "companies_company_type_id_fkey" FOREIGN KEY (company_type_id) REFERENCES company_types(id);
ALTER TABLE public."companies" ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES team_members(id);
ALTER TABLE public."companies" ADD CONSTRAINT "companies_primary_contact_id_fkey" FOREIGN KEY (primary_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public."company_raisons_sociales" ADD CONSTRAINT "company_raisons_sociales_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public."company_documents" ADD CONSTRAINT "company_documents_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public."contact_list_members" ADD CONSTRAINT "contact_list_members_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."contact_list_members" ADD CONSTRAINT "contact_list_members_list_id_fkey" FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE;
ALTER TABLE public."contact_lists" ADD CONSTRAINT "contact_lists_created_by_fkey" FOREIGN KEY (created_by) REFERENCES team_members(id);
ALTER TABLE public."contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."contacts" ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES team_members(id);
ALTER TABLE public."contacts" ADD CONSTRAINT "contacts_source_id_fkey" FOREIGN KEY (source_id) REFERENCES lead_sources(id);
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE public."deal_documents" ADD CONSTRAINT "deal_documents_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public."deal_documents" ADD CONSTRAINT "deal_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
ALTER TABLE public."deals" ADD CONSTRAINT "deals_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE public."deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public."deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES team_members(id);
ALTER TABLE public."deals" ADD CONSTRAINT "deals_source_id_fkey" FOREIGN KEY (source_id) REFERENCES lead_sources(id);
ALTER TABLE public."engagements" ADD CONSTRAINT "engagements_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."engagements" ADD CONSTRAINT "engagements_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."engagements" ADD CONSTRAINT "engagements_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id);
ALTER TABLE public."engagements" ADD CONSTRAINT "engagements_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id);
ALTER TABLE public."engagements" ADD CONSTRAINT "engagements_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES team_members(id);
ALTER TABLE public."expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public."inbox_accounts" ADD CONSTRAINT "inbox_accounts_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE public."invoice_documents" ADD CONSTRAINT "invoice_documents_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public."leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."leads" ADD CONSTRAINT "leads_company_type_id_fkey" FOREIGN KEY (company_type_id) REFERENCES company_types(id);
ALTER TABLE public."leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."leads" ADD CONSTRAINT "leads_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES team_members(id);
ALTER TABLE public."leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY (source_id) REFERENCES lead_sources(id);
ALTER TABLE public."learners" ADD CONSTRAINT "learners_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."learners" ADD CONSTRAINT "learners_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public."learners" ADD CONSTRAINT "learners_expert_id_fkey" FOREIGN KEY (expert_id) REFERENCES team_members(id);
ALTER TABLE public."learners" ADD CONSTRAINT "learners_program_id_fkey" FOREIGN KEY (program_id) REFERENCES training_programs(id);
ALTER TABLE public."learners" ADD CONSTRAINT "learners_training_type_id_fkey" FOREIGN KEY (training_type_id) REFERENCES training_types(id);
ALTER TABLE public."lms_answer_options" ADD CONSTRAINT "lms_answer_options_question_id_fkey" FOREIGN KEY (question_id) REFERENCES lms_questions(id) ON DELETE CASCADE;
ALTER TABLE public."lms_coach_conversations" ADD CONSTRAINT "lms_coach_conversations_current_step_id_fkey" FOREIGN KEY (current_step_id) REFERENCES lms_steps(id);
ALTER TABLE public."lms_coach_conversations" ADD CONSTRAINT "lms_coach_conversations_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."lms_coach_messages" ADD CONSTRAINT "lms_coach_messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES lms_coach_conversations(id) ON DELETE CASCADE;
ALTER TABLE public."lms_content_items" ADD CONSTRAINT "lms_content_items_module_id_fkey" FOREIGN KEY (module_id) REFERENCES lms_modules(id) ON DELETE CASCADE;
ALTER TABLE public."lms_content_views" ADD CONSTRAINT "lms_content_views_content_item_id_fkey" FOREIGN KEY (content_item_id) REFERENCES lms_content_items(id);
ALTER TABLE public."lms_content_views" ADD CONSTRAINT "lms_content_views_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."lms_enrollments" ADD CONSTRAINT "lms_enrollments_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."lms_enrollments" ADD CONSTRAINT "lms_enrollments_parcours_id_fkey" FOREIGN KEY (parcours_id) REFERENCES lms_parcours(id);
ALTER TABLE public."lms_enterprise_group_members" ADD CONSTRAINT "lms_enterprise_group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES lms_enterprise_groups(id) ON DELETE CASCADE;
ALTER TABLE public."lms_enterprise_group_members" ADD CONSTRAINT "lms_enterprise_group_members_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."lms_evaluation_attempts" ADD CONSTRAINT "lms_evaluation_attempts_evaluation_id_fkey" FOREIGN KEY (evaluation_id) REFERENCES lms_evaluations(id);
ALTER TABLE public."lms_evaluation_attempts" ADD CONSTRAINT "lms_evaluation_attempts_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."lms_evaluations" ADD CONSTRAINT "lms_evaluations_module_id_fkey" FOREIGN KEY (module_id) REFERENCES lms_modules(id) ON DELETE CASCADE;
ALTER TABLE public."lms_forum_categories" ADD CONSTRAINT "lms_forum_categories_step_id_fkey" FOREIGN KEY (step_id) REFERENCES lms_steps(id);
ALTER TABLE public."lms_forum_comments" ADD CONSTRAINT "lms_forum_comments_author_profile_id_fkey" FOREIGN KEY (author_profile_id) REFERENCES lms_learner_profiles(id);
ALTER TABLE public."lms_forum_comments" ADD CONSTRAINT "lms_forum_comments_parent_comment_id_fkey" FOREIGN KEY (parent_comment_id) REFERENCES lms_forum_comments(id);
ALTER TABLE public."lms_forum_comments" ADD CONSTRAINT "lms_forum_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES lms_forum_posts(id) ON DELETE CASCADE;
ALTER TABLE public."lms_forum_posts" ADD CONSTRAINT "lms_forum_posts_author_profile_id_fkey" FOREIGN KEY (author_profile_id) REFERENCES lms_learner_profiles(id);
ALTER TABLE public."lms_forum_posts" ADD CONSTRAINT "lms_forum_posts_category_id_fkey" FOREIGN KEY (category_id) REFERENCES lms_forum_categories(id);
ALTER TABLE public."lms_forum_reactions" ADD CONSTRAINT "lms_forum_reactions_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES lms_forum_comments(id) ON DELETE CASCADE;
ALTER TABLE public."lms_forum_reactions" ADD CONSTRAINT "lms_forum_reactions_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id);
ALTER TABLE public."lms_forum_reactions" ADD CONSTRAINT "lms_forum_reactions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES lms_forum_posts(id) ON DELETE CASCADE;
ALTER TABLE public."lms_module_progress" ADD CONSTRAINT "lms_module_progress_last_content_item_id_fkey" FOREIGN KEY (last_content_item_id) REFERENCES lms_content_items(id);
ALTER TABLE public."lms_module_progress" ADD CONSTRAINT "lms_module_progress_module_id_fkey" FOREIGN KEY (module_id) REFERENCES lms_modules(id);
ALTER TABLE public."lms_module_progress" ADD CONSTRAINT "lms_module_progress_step_progress_id_fkey" FOREIGN KEY (step_progress_id) REFERENCES lms_step_progress(id) ON DELETE CASCADE;
ALTER TABLE public."lms_modules" ADD CONSTRAINT "lms_modules_step_id_fkey" FOREIGN KEY (step_id) REFERENCES lms_steps(id) ON DELETE CASCADE;
ALTER TABLE public."lms_notifications" ADD CONSTRAINT "lms_notifications_enterprise_manager_id_fkey" FOREIGN KEY (enterprise_manager_id) REFERENCES lms_enterprise_managers(id) ON DELETE CASCADE;
ALTER TABLE public."lms_notifications" ADD CONSTRAINT "lms_notifications_learner_profile_id_fkey" FOREIGN KEY (learner_profile_id) REFERENCES lms_learner_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."lms_questions" ADD CONSTRAINT "lms_questions_evaluation_id_fkey" FOREIGN KEY (evaluation_id) REFERENCES lms_evaluations(id) ON DELETE CASCADE;
ALTER TABLE public."lms_step_progress" ADD CONSTRAINT "lms_step_progress_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES lms_enrollments(id) ON DELETE CASCADE;
ALTER TABLE public."lms_step_progress" ADD CONSTRAINT "lms_step_progress_step_id_fkey" FOREIGN KEY (step_id) REFERENCES lms_steps(id);
ALTER TABLE public."lms_steps" ADD CONSTRAINT "lms_steps_parcours_id_fkey" FOREIGN KEY (parcours_id) REFERENCES lms_parcours(id) ON DELETE CASCADE;
ALTER TABLE public."marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_fkey" FOREIGN KEY (created_by) REFERENCES team_members(id);
ALTER TABLE public."marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_list_id_fkey" FOREIGN KEY (list_id) REFERENCES contact_lists(id);
ALTER TABLE public."marketing_expense_documents" ADD CONSTRAINT "marketing_expense_documents_expense_id_fkey" FOREIGN KEY (expense_id) REFERENCES marketing_expenses(id) ON DELETE CASCADE;
ALTER TABLE public."marketing_expenses" ADD CONSTRAINT "marketing_expenses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES team_members(id);
ALTER TABLE public."marketing_weekly_stats" ADD CONSTRAINT "marketing_weekly_stats_created_by_fkey" FOREIGN KEY (created_by) REFERENCES team_members(id);
ALTER TABLE public."marketing_weekly_stats" ADD CONSTRAINT "marketing_weekly_stats_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES marketing_providers(id) ON DELETE CASCADE;
ALTER TABLE public."meeting_contacts" ADD CONSTRAINT "meeting_contacts_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."meeting_contacts" ADD CONSTRAINT "meeting_contacts_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public."meeting_managers" ADD CONSTRAINT "meeting_managers_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public."meeting_managers" ADD CONSTRAINT "meeting_managers_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public."meetings" ADD CONSTRAINT "meetings_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES team_members(id);
ALTER TABLE public."meetings" ADD CONSTRAINT "meetings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE public."meetings" ADD CONSTRAINT "meetings_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."meetings" ADD CONSTRAINT "meetings_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public."nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE public."nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_sequence_id_fkey" FOREIGN KEY (sequence_id) REFERENCES nurture_sequences(id) ON DELETE CASCADE;
ALTER TABLE public."nurture_steps" ADD CONSTRAINT "nurture_steps_sequence_id_fkey" FOREIGN KEY (sequence_id) REFERENCES nurture_sequences(id) ON DELETE CASCADE;
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_sales_id_fkey" FOREIGN KEY (sales_id) REFERENCES team_members(id);
ALTER TABLE public."post_attachments" ADD CONSTRAINT "post_attachments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE public."post_comments" ADD CONSTRAINT "post_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES team_members(id);
ALTER TABLE public."post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE public."post_reactions" ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE public."post_reactions" ADD CONSTRAINT "post_reactions_team_member_id_fkey" FOREIGN KEY (team_member_id) REFERENCES team_members(id);
ALTER TABLE public."posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY (author_id) REFERENCES team_members(id);
ALTER TABLE public."posts" ADD CONSTRAINT "posts_project_tag_id_fkey" FOREIGN KEY (project_tag_id) REFERENCES post_project_tags(id);
ALTER TABLE public."raison_sociale_learners" ADD CONSTRAINT "raison_sociale_learners_raison_sociale_id_fkey" FOREIGN KEY (raison_sociale_id) REFERENCES company_raisons_sociales(id) ON DELETE CASCADE;
ALTER TABLE public."raison_sociale_learners" ADD CONSTRAINT "raison_sociale_learners_learner_id_fkey" FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE;
ALTER TABLE public."quotations" ADD CONSTRAINT "quotations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE public."quotations" ADD CONSTRAINT "quotations_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public."quotations" ADD CONSTRAINT "quotations_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public."resources" ADD CONSTRAINT "resources_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES team_members(id);
ALTER TABLE public."service_plan_companies" ADD CONSTRAINT "service_plan_companies_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public."service_plan_companies" ADD CONSTRAINT "service_plan_companies_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public."service_plan_companies" ADD CONSTRAINT "service_plan_companies_service_plan_id_fkey" FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE;
ALTER TABLE public."service_plan_learners" ADD CONSTRAINT "service_plan_learners_learner_id_fkey" FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE;
ALTER TABLE public."service_plan_learners" ADD CONSTRAINT "service_plan_learners_service_plan_id_fkey" FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE;
ALTER TABLE public."service_plans" ADD CONSTRAINT "service_plans_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."service_plans" ADD CONSTRAINT "service_plans_deal_id_fkey" FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public."service_plans" ADD CONSTRAINT "service_plans_primary_trainer_id_fkey" FOREIGN KEY (primary_trainer_id) REFERENCES team_members(id);
ALTER TABLE public."service_plans" ADD CONSTRAINT "service_plans_program_id_fkey" FOREIGN KEY (program_id) REFERENCES training_programs(id);
ALTER TABLE public."service_plans" ADD CONSTRAINT "service_plans_training_type_id_fkey" FOREIGN KEY (training_type_id) REFERENCES training_types(id);
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_theme_id_fkey" FOREIGN KEY (theme_id) REFERENCES session_themes(id);
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_trainer_id_fkey" FOREIGN KEY (trainer_id) REFERENCES team_members(id);
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
ALTER TABLE public."training_session_learners" ADD CONSTRAINT "training_session_learners_learner_id_fkey" FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE;
ALTER TABLE public."training_session_learners" ADD CONSTRAINT "training_session_learners_training_session_id_fkey" FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."training_sessions" ADD CONSTRAINT "training_sessions_service_plan_id_fkey" FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE;

-- ============================================================
-- Indexes: public
-- ============================================================
CREATE INDEX idx_activities_due_date ON public.activities USING btree (due_date);
CREATE INDEX idx_activities_team_member ON public.activities USING btree (team_member_id);
CREATE INDEX idx_automation_steps_workflow_id ON public.automation_steps USING btree (workflow_id);
CREATE INDEX idx_automation_workflows_category ON public.automation_workflows USING btree (category);
CREATE INDEX idx_automation_workflows_slug ON public.automation_workflows USING btree (slug);
CREATE INDEX idx_billing_documents_entry_id ON public.billing_documents USING btree (billing_entry_id);
CREATE INDEX idx_billing_entries_fiscal_year ON public.billing_entries USING btree (fiscal_year);
CREATE INDEX billing_months_invoice_retry_idx ON public.billing_months USING btree (status, invoice_email_sent) WHERE (pennylane_invoice_id IS NOT NULL);
CREATE INDEX billing_months_planifie_due_idx ON public.billing_months USING btree (status, month) WHERE (status = 'planifie'::text);
CREATE INDEX idx_billing_months_entry_id ON public.billing_months USING btree (billing_entry_id);
CREATE INDEX idx_category_members_category ON public.category_members USING btree (category);
CREATE INDEX idx_category_members_member ON public.category_members USING btree (team_member_id);
CREATE INDEX idx_companies_lifecycle ON public.companies USING btree (lifecycle_stage);
CREATE INDEX idx_company_raisons_sociales_company_id ON public.company_raisons_sociales USING btree (company_id);
CREATE INDEX idx_raison_sociale_learners_raison_id ON public.raison_sociale_learners USING btree (raison_sociale_id);
CREATE INDEX idx_raison_sociale_learners_learner_id ON public.raison_sociale_learners USING btree (learner_id);
CREATE INDEX idx_company_documents_company_id ON public.company_documents USING btree (company_id);
CREATE INDEX idx_contacts_company ON public.contacts USING btree (company_id);
CREATE INDEX idx_contacts_lifecycle ON public.contacts USING btree (lifecycle_stage);
CREATE UNIQUE INDEX conversations_chat_uniq ON public.conversations USING btree (channel, external_chat_id) WHERE (external_chat_id IS NOT NULL);
CREATE INDEX conversations_followup_idx ON public.conversations USING btree (agent_status, agent_last_acted_at) WHERE (agent_status = 'active'::text);
CREATE INDEX conversations_inbox_idx ON public.conversations USING btree (owner_id, agent_status, last_message_at DESC);
CREATE INDEX conversations_triage_idx ON public.conversations USING btree (triage_folder) WHERE (triage_folder IS NOT NULL);
CREATE INDEX idx_deal_documents_deal ON public.deal_documents USING btree (deal_id);
CREATE INDEX deals_wf009_feedback_idx ON public.deals USING btree (wf009_suggestion_correct) WHERE (wf009_suggestion_correct IS NOT NULL);
CREATE INDEX idx_deals_adv_to_validate ON public.deals USING btree (stage, convention_status) WHERE ((stage = 'quote_to_validate'::text) OR (convention_status = 'to_validate'::text));
CREATE INDEX idx_deals_company ON public.deals USING btree (company_id);
CREATE INDEX idx_deals_contact ON public.deals USING btree (contact_id);
CREATE INDEX idx_deals_firma_convention_signing ON public.deals USING btree (firma_convention_signing_id) WHERE (firma_convention_signing_id IS NOT NULL);
CREATE INDEX idx_deals_firma_devis_signing ON public.deals USING btree (firma_devis_signing_id) WHERE (firma_devis_signing_id IS NOT NULL);
CREATE INDEX idx_deals_owner ON public.deals USING btree (owner_id);
CREATE INDEX idx_deals_pennylane_invoice_id ON public.deals USING btree (pennylane_invoice_id) WHERE (pennylane_invoice_id IS NOT NULL);
CREATE INDEX idx_deals_pennylane_quote_id ON public.deals USING btree (pennylane_quote_id) WHERE (pennylane_quote_id IS NOT NULL);
CREATE INDEX idx_deals_quote_scheduled_send ON public.deals USING btree (quote_scheduled_send_at) WHERE ((quote_scheduled_send_at IS NOT NULL) AND (pennylane_quote_id IS NULL));
CREATE INDEX idx_deals_stage ON public.deals USING btree (stage);
CREATE INDEX email_log_created_at_idx ON public.email_log USING btree (created_at DESC);
CREATE INDEX email_log_recipient_idx ON public.email_log USING btree (recipient);
CREATE INDEX email_log_related_entity_idx ON public.email_log USING btree (related_entity_id);
CREATE INDEX idx_engagements_contact_id ON public.engagements USING btree (contact_id);
CREATE INDEX idx_engagements_created_at ON public.engagements USING btree (created_at DESC);
CREATE INDEX idx_engagements_deal_id ON public.engagements USING btree (deal_id);
CREATE INDEX idx_engagements_external_id ON public.engagements USING btree (external_id) WHERE (external_id IS NOT NULL);
CREATE INDEX idx_engagements_source_wf ON public.engagements USING btree (source_workflow) WHERE (source_workflow IS NOT NULL);
CREATE INDEX idx_engagements_type ON public.engagements USING btree (type);
CREATE INDEX idx_expenses_month ON public.expenses USING btree (month);
CREATE INDEX idx_invoice_documents_invoice ON public.invoice_documents USING btree (invoice_id);
CREATE INDEX idx_invoices_company ON public.invoices USING btree (company_id);
CREATE INDEX idx_invoices_deal_id ON public.invoices USING btree (deal_id);
CREATE INDEX idx_invoices_month ON public.invoices USING btree (month);
CREATE INDEX idx_leads_month_year ON public.leads USING btree (month_year);
CREATE INDEX idx_leads_sales_id ON public.leads USING btree (sales_id);
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_learners_company ON public.learners USING btree (company_id);
CREATE INDEX idx_learners_status ON public.learners USING btree (status);
CREATE INDEX idx_meeting_contacts_contact ON public.meeting_contacts USING btree (contact_id);
CREATE INDEX idx_meeting_contacts_meeting ON public.meeting_contacts USING btree (meeting_id);
CREATE INDEX idx_meeting_managers_meeting ON public.meeting_managers USING btree (meeting_id);
CREATE INDEX idx_meeting_managers_member ON public.meeting_managers USING btree (team_member_id);
CREATE INDEX idx_meetings_contact ON public.meetings USING btree (contact_id);
CREATE INDEX idx_meetings_lead ON public.meetings USING btree (lead_id);
CREATE INDEX idx_meetings_scheduled ON public.meetings USING btree (scheduled_at);
CREATE INDEX idx_meetings_status ON public.meetings USING btree (status);
CREATE INDEX idx_meetings_type ON public.meetings USING btree (meeting_type);
CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);
CREATE UNIQUE INDEX messages_external_id_uniq ON public.messages USING btree (external_message_id) WHERE (external_message_id IS NOT NULL);
CREATE INDEX idx_notifications_recipient_created ON public.notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_unread ON public.notifications USING btree (recipient_id, read_at) WHERE (read_at IS NULL);
CREATE INDEX idx_notifications_related_entity ON public.notifications USING btree (related_entity_type, related_entity_id);
CREATE UNIQUE INDEX nurture_enrollments_active_uidx ON public.nurture_enrollments USING btree (sequence_id, contact_id) WHERE (status = 'active'::text);
CREATE INDEX nurture_enrollments_contact_idx ON public.nurture_enrollments USING btree (contact_id);
CREATE INDEX nurture_enrollments_due_idx ON public.nurture_enrollments USING btree (next_send_at) WHERE (status = 'active'::text);
CREATE INDEX nurture_steps_sequence_idx ON public.nurture_steps USING btree (sequence_id, step_order);
CREATE INDEX idx_opportunities_sales_id ON public.opportunities USING btree (sales_id);
CREATE INDEX idx_opportunities_stage ON public.opportunities USING btree (stage);
CREATE INDEX idx_post_attachments_post_id ON public.post_attachments USING btree (post_id);
CREATE INDEX idx_post_comments_post_id ON public.post_comments USING btree (post_id, created_at);
CREATE INDEX idx_post_reactions_post_id ON public.post_reactions USING btree (post_id);
CREATE INDEX idx_posts_author_id ON public.posts USING btree (author_id);
CREATE INDEX idx_posts_category ON public.posts USING btree (category);
CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);
CREATE INDEX idx_quotations_deal_id ON public.quotations USING btree (deal_id);
CREATE INDEX idx_spc_company_id ON public.service_plan_companies USING btree (company_id);
CREATE INDEX idx_spc_service_plan_id ON public.service_plan_companies USING btree (service_plan_id);
CREATE INDEX idx_service_plans_deal_id ON public.service_plans USING btree (deal_id);
CREATE INDEX idx_sessions_company ON public.sessions USING btree (company_id);
CREATE INDEX idx_sessions_date ON public.sessions USING btree (session_date);
CREATE INDEX idx_sessions_trainer ON public.sessions USING btree (trainer_id);
CREATE INDEX idx_tsl_learner ON public.training_session_learners USING btree (learner_id);
CREATE INDEX idx_tsl_session ON public.training_session_learners USING btree (training_session_id);
CREATE INDEX idx_training_sessions_date ON public.training_sessions USING btree (session_date);
CREATE INDEX idx_training_sessions_plan_id ON public.training_sessions USING btree (service_plan_id);

-- ============================================================
-- Functions: public
-- ============================================================
CREATE OR REPLACE FUNCTION public.enroll_noshow_nurture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slug text;
  v_seq_id uuid;
  v_done_count int;
begin
  if new.status = 'no_show'
     and (old.status is distinct from 'no_show')
     and new.contact_id is not null then
    begin
      select count(*) into v_done_count
        from meetings
        where contact_id = new.contact_id and status = 'done' and id <> new.id;

      v_slug := case when v_done_count > 0 then 'noshow-r1' else 'noshow-r0' end;

      select id into v_seq_id from nurture_sequences where slug = v_slug and is_active;
      if v_seq_id is not null then
        -- L'index partiel nurture_enrollments_active_uidx empêche un doublon ACTIF ;
        -- une unique_violation (ré-enrôlement tant que l'ancien est actif) est absorbée ci-dessous.
        insert into nurture_enrollments (sequence_id, contact_id, meeting_id, status, current_step, next_send_at)
        values (v_seq_id, new.contact_id, new.id, 'active', 0, now());
      end if;
    exception
      when others then
        raise warning 'enroll_noshow_nurture (non-blocking): %', sqlerrm;
    end;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
  SELECT extensions.unaccent('extensions.unaccent', $1);
$function$
;

CREATE OR REPLACE FUNCTION public.find_company_by_normalized_name(p_name text)
 RETURNS TABLE(id uuid, name text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name
  FROM companies c
  WHERE normalize_company_name(c.name) = p_name
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_contact_by_normalized_phone(p_phone text)
 RETURNS TABLE(id uuid, email text, phone text, lifecycle_stage text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id, c.email, c.phone, c.lifecycle_stage
  FROM contacts c
  WHERE c.phone IS NOT NULL AND c.phone != ''
    AND normalize_phone_number(c.phone) = p_phone
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.global_search(search_query text, max_per_type integer DEFAULT 5)
 RETURNS TABLE(id uuid, result_type text, label text, sub text, href text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  normalized text;
  phone_raw text;
  phone_variants text[];
BEGIN
  -- Normalize: lowercase + remove accents
  normalized := lower(public.f_unaccent(trim(search_query)));
  -- Strip all non-digit characters from search query
  phone_raw := regexp_replace(trim(search_query), '[^\d]', '', 'g');

  -- Build phone variants to handle 06→336 and 336→06 conversions
  IF length(phone_raw) >= 3 THEN
    phone_variants := ARRAY[phone_raw];
    -- If starts with 0, also search with 33 prefix
    IF phone_raw LIKE '0%' THEN
      phone_variants := phone_variants || ('33' || substring(phone_raw from 2));
    END IF;
    -- If starts with 33, also search with 0 prefix
    IF phone_raw LIKE '33%' THEN
      phone_variants := phone_variants || ('0' || substring(phone_raw from 3));
    END IF;
  ELSE
    phone_variants := ARRAY[phone_raw];
  END IF;

  -- Search contacts
  RETURN QUERY
  SELECT c.id, 'contact'::text,
    (c.first_name || ' ' || c.last_name)::text,
    COALESCE(co.name, c.email, 'Contact')::text,
    ('/contacts/' || c.id)::text
  FROM contacts c
  LEFT JOIN companies co ON co.id = c.company_id
  WHERE
    lower(public.f_unaccent(c.first_name)) LIKE '%' || normalized || '%'
    OR lower(public.f_unaccent(c.last_name)) LIKE '%' || normalized || '%'
    OR lower(public.f_unaccent(c.first_name || ' ' || c.last_name)) LIKE '%' || normalized || '%'
    OR lower(public.f_unaccent(c.last_name || ' ' || c.first_name)) LIKE '%' || normalized || '%'
    OR lower(c.email) LIKE '%' || normalized || '%'
    OR (c.phone IS NOT NULL AND length(phone_raw) >= 3 AND EXISTS (
      SELECT 1 FROM unnest(phone_variants) v
      WHERE regexp_replace(c.phone, '[^\d]', '', 'g') LIKE '%' || v || '%'
    ))
  LIMIT max_per_type;

  -- Search companies
  RETURN QUERY
  SELECT comp.id, 'company'::text,
    comp.name::text,
    COALESCE(comp.city, 'Entreprise')::text,
    ('/clients/' || comp.id)::text
  FROM companies comp
  WHERE lower(public.f_unaccent(comp.name)) LIKE '%' || normalized || '%'
  LIMIT max_per_type;

  -- Search deals
  RETURN QUERY
  SELECT d.id, 'deal'::text,
    d.name::text,
    COALESCE(co2.name,
      CASE WHEN d.amount IS NOT NULL THEN d.amount::text || ' €' ELSE 'Deal' END
    )::text,
    '/deals'::text
  FROM deals d
  LEFT JOIN companies co2 ON co2.id = d.company_id
  WHERE lower(public.f_unaccent(d.name)) LIKE '%' || normalized || '%'
  LIMIT max_per_type;

  -- Search learners
  RETURN QUERY
  SELECT l.id, 'learner'::text,
    (l.first_name || ' ' || l.last_name)::text,
    COALESCE(co3.name, l.email, 'Apprenant')::text,
    ('/learners/' || l.id)::text
  FROM learners l
  LEFT JOIN companies co3 ON co3.id = l.company_id
  WHERE
    lower(public.f_unaccent(l.first_name)) LIKE '%' || normalized || '%'
    OR lower(public.f_unaccent(l.last_name)) LIKE '%' || normalized || '%'
    OR lower(public.f_unaccent(l.first_name || ' ' || l.last_name)) LIKE '%' || normalized || '%'
    OR lower(public.f_unaccent(l.last_name || ' ' || l.first_name)) LIKE '%' || normalized || '%'
    OR lower(l.email) LIKE '%' || normalized || '%'
    OR (l.phone IS NOT NULL AND length(phone_raw) >= 3 AND EXISTS (
      SELECT 1 FROM unnest(phone_variants) v
      WHERE regexp_replace(l.phone, '[^\d]', '', 'g') LIKE '%' || v || '%'
    ))
  LIMIT max_per_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.next_quote_number(p_year integer)
 RETURNS integer
 LANGUAGE sql
AS $function$
    insert into quote_sequences (year, last_value) values (p_year, 1)
    on conflict (year) do update set last_value = quote_sequences.last_value + 1
    returning last_value;
  $function$
;

CREATE OR REPLACE FUNCTION public.normalize_company_name(n text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF n IS NULL OR n = '' THEN RETURN NULL; END IF;
  n := lower(n);
  n := replace(replace(replace(n, '-', ' '), '_', ' '), '.', ' ');
  n := regexp_replace(n, '\s+', ' ', 'g');
  n := trim(n);
  RETURN n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_phone_number(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p IS NULL OR p = '' THEN RETURN NULL; END IF;
  p := regexp_replace(p, '[^0-9]', '', 'g');
  IF length(p) = 12 AND p LIKE '0033%' THEN
    p := '0' || substring(p from 5);
  END IF;
  IF length(p) = 11 AND p LIKE '33%' THEN
    p := '0' || substring(p from 3);
  END IF;
  RETURN p;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_contact_owner_from_meeting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET owner_id = NEW.assigned_to
    WHERE id = NEW.contact_id
      AND owner_id IS NULL;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_deal_source_from_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.source_id IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT c.source_id INTO NEW.source_id
    FROM public.contacts c
    WHERE c.id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.uppercase_last_name()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.last_name IS NOT NULL THEN
    NEW.last_name := UPPER(NEW.last_name);
  END IF;
  RETURN NEW;
END;
$function$
;

-- ============================================================
-- Triggers: public
-- ============================================================
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_uppercase_last_name BEFORE INSERT OR UPDATE OF last_name ON public.contacts FOR EACH ROW EXECUTE FUNCTION uppercase_last_name();
CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_set_deal_source_from_contact_ins BEFORE INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION set_deal_source_from_contact();
CREATE TRIGGER trg_set_deal_source_from_contact_upd BEFORE UPDATE OF contact_id, stage ON public.deals FOR EACH ROW WHEN ((new.source_id IS NULL)) EXECUTE FUNCTION set_deal_source_from_contact();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_learners_updated_at BEFORE UPDATE ON public.learners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_learners_uppercase_last_name BEFORE INSERT OR UPDATE OF last_name ON public.learners FOR EACH ROW EXECUTE FUNCTION uppercase_last_name();
CREATE TRIGGER trg_enroll_noshow_nurture AFTER UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION enroll_noshow_nurture();
CREATE TRIGGER trg_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_set_contact_owner_from_meeting_ins AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION set_contact_owner_from_meeting();
CREATE TRIGGER trg_set_contact_owner_from_meeting_upd AFTER UPDATE OF assigned_to ON public.meetings FOR EACH ROW WHEN ((new.assigned_to IS NOT NULL)) EXECUTE FUNCTION set_contact_owner_from_meeting();
CREATE TRIGGER trg_monthly_finances_updated_at BEFORE UPDATE ON public.monthly_finances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_targets_updated_at BEFORE UPDATE ON public.sales_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_service_plans_updated_at BEFORE UPDATE ON public.service_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security: public
-- ============================================================
ALTER TABLE public."activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agent_escalation_keywords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automation_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automation_workflows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing_months" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."campaign_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."category_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comment_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comment_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."company_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."company_raisons_sociales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."company_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."raison_sociale_learners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contact_list_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contact_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."email_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."engagements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inbox_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."invoice_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lead_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."learners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_answer_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_coach_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_coach_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_content_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_content_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_enterprise_group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_enterprise_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_enterprise_managers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_evaluation_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_forum_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_forum_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_forum_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_forum_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_learner_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_module_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_parcours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_step_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_expense_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_weekly_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."meeting_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."meeting_managers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."monthly_charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."monthly_finances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nurture_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nurture_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nurture_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."opportunities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."post_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."post_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."post_project_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."post_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."quotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."quote_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sales_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_plan_companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_plan_learners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."session_themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."training_programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."training_session_learners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."training_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."training_types" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can modify all" ON public."activities" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."activities" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "keywords_select_authenticated" ON public."agent_escalation_keywords" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "keywords_write_admin" ON public."agent_escalation_keywords" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles))))));
CREATE POLICY "Authenticated users can read steps" ON public."automation_steps" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage steps" ON public."automation_steps" AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read workflows" ON public."automation_workflows" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage workflows" ON public."automation_workflows" AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "Allow all for authenticated" ON public."billing_documents" AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Allow all for authenticated" ON public."billing_entries" AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Allow all for authenticated" ON public."billing_months" AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "auth delete recipients" ON public."campaign_recipients" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth insert recipients" ON public."campaign_recipients" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read recipients" ON public."campaign_recipients" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update recipients" ON public."campaign_recipients" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public."category_members" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public."category_members" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can view comment attachments" ON public."comment_attachments" AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can delete comment attachments" ON public."comment_attachments" AS PERMISSIVE FOR DELETE TO public USING (true);
CREATE POLICY "Authenticated users can insert comment attachments" ON public."comment_attachments" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated users can delete own comment reactions" ON public."comment_reactions" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert comment reactions" ON public."comment_reactions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read comment reactions" ON public."comment_reactions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."companies" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."companies" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage company documents" ON public."company_documents" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything on company_raisons_social" ON public."company_raisons_sociales" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything on raison_sociale_learner" ON public."raison_sociale_learners" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."company_types" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."company_types" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth delete clm" ON public."contact_list_members" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth insert clm" ON public."contact_list_members" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read clm" ON public."contact_list_members" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth delete contact_lists" ON public."contact_lists" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth insert contact_lists" ON public."contact_lists" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read contact_lists" ON public."contact_lists" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update contact_lists" ON public."contact_lists" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."contacts" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."contacts" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversations_select_authenticated" ON public."conversations" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversations_write_admin" ON public."conversations" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles))))));
CREATE POLICY "Authenticated users can manage deal_documents" ON public."deal_documents" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."deals" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."deals" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_log_select_authenticated" ON public."email_log" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public."engagements" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."expense_categories" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."expense_categories" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."expenses" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."expenses" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "inbox_accounts_select_authenticated" ON public."inbox_accounts" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "inbox_accounts_write_admin" ON public."inbox_accounts" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles))))));
CREATE POLICY "Authenticated users can manage invoice_documents" ON public."invoice_documents" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."invoices" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."invoices" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."lead_sources" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."lead_sources" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."leads" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."leads" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."learners" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."learners" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Answer options readable by authenticated" ON public."lms_answer_options" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coach conversations own" ON public."lms_coach_conversations" AS PERMISSIVE FOR ALL TO authenticated USING ((learner_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Coach messages own" ON public."lms_coach_messages" AS PERMISSIVE FOR ALL TO authenticated USING ((conversation_id IN ( SELECT cc.id
   FROM (lms_coach_conversations cc
     JOIN lms_learner_profiles lp ON ((lp.id = cc.learner_profile_id)))
  WHERE (lp.auth_user_id = auth.uid()))));
CREATE POLICY "Content items readable by authenticated" ON public."lms_content_items" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Content views own" ON public."lms_content_views" AS PERMISSIVE FOR ALL TO authenticated USING ((learner_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Enrollments own read" ON public."lms_enrollments" AS PERMISSIVE FOR SELECT TO authenticated USING ((learner_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Enterprise group members read" ON public."lms_enterprise_group_members" AS PERMISSIVE FOR SELECT TO authenticated USING ((group_id IN ( SELECT g.id
   FROM (lms_enterprise_groups g
     JOIN lms_enterprise_managers m ON ((m.company_id = g.company_id)))
  WHERE (m.auth_user_id = auth.uid()))));
CREATE POLICY "Enterprise groups company read" ON public."lms_enterprise_groups" AS PERMISSIVE FOR SELECT TO authenticated USING ((company_id IN ( SELECT lms_enterprise_managers.company_id
   FROM lms_enterprise_managers
  WHERE (lms_enterprise_managers.auth_user_id = auth.uid()))));
CREATE POLICY "Enterprise managers own" ON public."lms_enterprise_managers" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth_user_id = auth.uid()));
CREATE POLICY "Eval attempts own" ON public."lms_evaluation_attempts" AS PERMISSIVE FOR ALL TO authenticated USING ((learner_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Evaluations readable by authenticated" ON public."lms_evaluations" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Forum categories readable by authenticated" ON public."lms_forum_categories" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Forum comments own insert" ON public."lms_forum_comments" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((author_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Forum comments readable" ON public."lms_forum_comments" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Forum posts own insert" ON public."lms_forum_posts" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((author_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Forum posts readable" ON public."lms_forum_posts" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Forum reactions own" ON public."lms_forum_reactions" AS PERMISSIVE FOR ALL TO authenticated USING ((learner_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))));
CREATE POLICY "Learner profiles company read" ON public."lms_learner_profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((company_id IN ( SELECT lms_enterprise_managers.company_id
   FROM lms_enterprise_managers
  WHERE (lms_enterprise_managers.auth_user_id = auth.uid()))));
CREATE POLICY "Learner profiles own read" ON public."lms_learner_profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = auth_user_id));
CREATE POLICY "Module progress own read" ON public."lms_module_progress" AS PERMISSIVE FOR SELECT TO authenticated USING ((step_progress_id IN ( SELECT sp.id
   FROM ((lms_step_progress sp
     JOIN lms_enrollments e ON ((e.id = sp.enrollment_id)))
     JOIN lms_learner_profiles lp ON ((lp.id = e.learner_profile_id)))
  WHERE (lp.auth_user_id = auth.uid()))));
CREATE POLICY "Modules readable by authenticated" ON public."lms_modules" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Notifications own" ON public."lms_notifications" AS PERMISSIVE FOR ALL TO authenticated USING (((learner_profile_id IN ( SELECT lms_learner_profiles.id
   FROM lms_learner_profiles
  WHERE (lms_learner_profiles.auth_user_id = auth.uid()))) OR (enterprise_manager_id IN ( SELECT lms_enterprise_managers.id
   FROM lms_enterprise_managers
  WHERE (lms_enterprise_managers.auth_user_id = auth.uid())))));
CREATE POLICY "Parcours readable by authenticated" ON public."lms_parcours" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Questions readable by authenticated" ON public."lms_questions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Step progress own read" ON public."lms_step_progress" AS PERMISSIVE FOR SELECT TO authenticated USING ((enrollment_id IN ( SELECT e.id
   FROM (lms_enrollments e
     JOIN lms_learner_profiles lp ON ((lp.id = e.learner_profile_id)))
  WHERE (lp.auth_user_id = auth.uid()))));
CREATE POLICY "Steps readable by authenticated" ON public."lms_steps" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth delete campaigns" ON public."marketing_campaigns" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth insert campaigns" ON public."marketing_campaigns" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read campaigns" ON public."marketing_campaigns" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update campaigns" ON public."marketing_campaigns" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "marketing_expense_documents_all" ON public."marketing_expense_documents" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "auth delete expenses" ON public."marketing_expenses" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth insert expenses" ON public."marketing_expenses" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read expenses" ON public."marketing_expenses" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update expenses" ON public."marketing_expenses" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete providers" ON public."marketing_providers" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert providers" ON public."marketing_providers" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read providers" ON public."marketing_providers" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update providers" ON public."marketing_providers" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stats" ON public."marketing_weekly_stats" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stats" ON public."marketing_weekly_stats" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read stats" ON public."marketing_weekly_stats" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update stats" ON public."marketing_weekly_stats" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public."meeting_contacts" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public."meeting_contacts" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public."meeting_managers" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public."meeting_managers" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."meetings" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."meetings" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_select_authenticated" ON public."messages" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_write_admin" ON public."messages" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.auth_user_id = auth.uid()) AND ('Admin'::text = ANY (team_members.roles))))));
CREATE POLICY "Authenticated users can manage monthly_charges" ON public."monthly_charges" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."monthly_finances" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."monthly_finances" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_delete" ON public."notifications" AS PERMISSIVE FOR DELETE TO public USING (true);
CREATE POLICY "notifications_insert" ON public."notifications" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "notifications_select" ON public."notifications" AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "notifications_update" ON public."notifications" AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "nurture_enrollments_select_authenticated" ON public."nurture_enrollments" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "nurture_sequences_select_authenticated" ON public."nurture_sequences" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "nurture_steps_select_authenticated" ON public."nurture_steps" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."opportunities" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."opportunities" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_attachments_delete" ON public."post_attachments" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "post_attachments_insert" ON public."post_attachments" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "post_attachments_select" ON public."post_attachments" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_comments_delete" ON public."post_comments" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "post_comments_insert" ON public."post_comments" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "post_comments_select" ON public."post_comments" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_comments_update" ON public."post_comments" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "post_project_tags_delete" ON public."post_project_tags" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "post_project_tags_insert" ON public."post_project_tags" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "post_project_tags_select" ON public."post_project_tags" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_project_tags_update" ON public."post_project_tags" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "post_reactions_delete" ON public."post_reactions" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "post_reactions_insert" ON public."post_reactions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "post_reactions_select" ON public."post_reactions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_delete" ON public."posts" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "posts_insert" ON public."posts" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "posts_select" ON public."posts" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_update" ON public."posts" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users full access" ON public."quotations" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete resources" ON public."resources" AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth insert resources" ON public."resources" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read resources" ON public."resources" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update resources" ON public."resources" AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."sales_targets" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."sales_targets" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public."service_plan_companies" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."service_plan_learners" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."service_plan_learners" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."service_plans" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."service_plans" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."session_themes" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."session_themes" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."sessions" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."sessions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."team_members" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."team_members" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify all" ON public."training_programs" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."training_programs" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage training_session_learners" ON public."training_session_learners" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage training_sessions" ON public."training_sessions" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can modify all" ON public."training_types" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read all" ON public."training_types" AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Storage policies (custom — on storage.objects)
-- ============================================================
CREATE POLICY "Allow authenticated uploads" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'note-attachments'::text));
CREATE POLICY "Allow public read" ON storage."objects" AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'note-attachments'::text));
CREATE POLICY "Auth users can delete company docs" ON storage."objects" AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'company-documents'::text));
CREATE POLICY "Auth users can read company docs" ON storage."objects" AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'company-documents'::text));
CREATE POLICY "Auth users can upload company docs" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'company-documents'::text));
CREATE POLICY "Auth users delete invoice docs" ON storage."objects" AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'invoice-documents'::text));
CREATE POLICY "Auth users read invoice docs" ON storage."objects" AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'invoice-documents'::text));
CREATE POLICY "Auth users upload invoice docs" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'invoice-documents'::text));
CREATE POLICY "Authenticated users can delete avatars" ON storage."objects" AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Authenticated users can delete deal documents" ON storage."objects" AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'deal-documents'::text));
CREATE POLICY "Authenticated users can read deal documents" ON storage."objects" AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'deal-documents'::text));
CREATE POLICY "Authenticated users can update avatars" ON storage."objects" AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Authenticated users can upload avatars" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));
CREATE POLICY "Authenticated users can upload deal documents" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'deal-documents'::text));
CREATE POLICY "Public can read avatars" ON storage."objects" AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));
CREATE POLICY "auth delete resources storage" ON storage."objects" AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'resources'::text));
CREATE POLICY "auth insert resources storage" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'resources'::text));
CREATE POLICY "auth read resources storage" ON storage."objects" AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'resources'::text));
CREATE POLICY "marketing_expense_docs_delete" ON storage."objects" AS PERMISSIVE FOR DELETE TO public USING ((bucket_id = 'marketing-expense-documents'::text));
CREATE POLICY "marketing_expense_docs_insert" ON storage."objects" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((bucket_id = 'marketing-expense-documents'::text));
CREATE POLICY "marketing_expense_docs_select" ON storage."objects" AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'marketing-expense-documents'::text));
CREATE POLICY "post_attachments_storage_delete" ON storage."objects" AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'post-attachments'::text));
CREATE POLICY "post_attachments_storage_insert" ON storage."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'post-attachments'::text));
CREATE POLICY "post_attachments_storage_select" ON storage."objects" AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'post-attachments'::text));

-- ============================================================
-- Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']::text[], false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('billing-documents', 'billing-documents', false, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('company-documents', 'company-documents', false, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('deal-documents', 'deal-documents', false, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('invoice-documents', 'invoice-documents', false, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('marketing-expense-documents', 'marketing-expense-documents', false, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('note-attachments', 'note-attachments', true, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('post-attachments', 'post-attachments', true, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('public-downloads', 'public-downloads', true, 300000000, NULL, false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES ('resources', 'resources', false, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;

COMMIT;
