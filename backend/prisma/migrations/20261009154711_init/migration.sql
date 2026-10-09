-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('fundenflo', 'lender', 'partner', 'business');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('pending', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('borrower', 'business_owner', 'authorised_signatory', 'business_member', 'partner_owner', 'partner_agent', 'lender_admin', 'lender_credit_officer', 'lender_viewer', 'super_admin', 'ops_lead', 'ops_reviewer', 'credit_analyst', 'lender_manager', 'partner_manager', 'finance', 'compliance_officer', 'support');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "LoginMethod" AS ENUM ('mobile_otp', 'email_otp', 'password', 'google', 'apple');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('login', 'link_login', 'mobile_change');

-- CreateEnum
CREATE TYPE "LoginAs" AS ENUM ('borrower', 'ca', 'dsa', 'lender');

-- CreateEnum
CREATE TYPE "SessionContext" AS ENUM ('none', 'borrower', 'partner', 'lender', 'staff');

-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('person', 'business');

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('active', 'merged', 'archived');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('mobile', 'email', 'landline');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('pan', 'gstin', 'cin', 'udyam', 'din');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('proprietor_of', 'director_of', 'partner_of', 'signatory_of', 'employee_of');

-- CreateEnum
CREATE TYPE "MatchReviewStatus" AS ENUM ('open', 'linked', 'dismissed');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'system', 'ai_agent', 'api_client', 'webhook');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email', 'push', 'whatsapp');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "context" "SessionContext" NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'pending',
    "scope" JSONB,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "context" "SessionContext" NOT NULL,
    "role" "Role" NOT NULL,
    "channel" "ContactType" NOT NULL,
    "identifier_hash" TEXT NOT NULL,
    "identifier_enc" TEXT NOT NULL,
    "identifier_masked" TEXT NOT NULL,
    "token_hash" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "invited_by_user_id" UUID,
    "accepted_user_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "signup_channel" TEXT NOT NULL,
    "signup_referral_code" TEXT,
    "last_login_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_logins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method" "LoginMethod" NOT NULL,
    "identifier_hash" TEXT NOT NULL,
    "identifier_enc" TEXT NOT NULL,
    "identifier_masked" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_logins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_credentials" (
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_enc" TEXT,
    "totp_enabled_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "ContactType" NOT NULL,
    "identifier_hash" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "user_id" UUID,
    "login_as" "LoginAs",
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "resend_available_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "membership_id" UUID,
    "context" "SessionContext" NOT NULL,
    "login_method" "LoginMethod" NOT NULL,
    "device_id" TEXT,
    "device_name" TEXT,
    "platform" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "push_token" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "rotated_from_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "kind" "PartyKind" NOT NULL,
    "display_name" TEXT,
    "preferred_language" TEXT,
    "status" "PartyStatus" NOT NULL DEFAULT 'active',
    "merged_into_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_contacts" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "type" "ContactType" NOT NULL,
    "value_enc" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "value_masked" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "invalid_at" TIMESTAMPTZ(3),
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "party_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_identifiers" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value_enc" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "value_masked" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "party_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_relationships" (
    "id" UUID NOT NULL,
    "from_party_id" UUID NOT NULL,
    "to_party_id" UUID NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "share_bps" INTEGER,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_merges" (
    "id" UUID NOT NULL,
    "source_party_id" UUID NOT NULL,
    "target_party_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "merged_by_user_id" UUID,
    "merged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reverted_at" TIMESTAMPTZ(3),
    "reverted_by_user_id" UUID,

    CONSTRAINT "party_merges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_match_reviews" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "candidate_party_ids" UUID[],
    "signals" JSONB NOT NULL,
    "status" "MatchReviewStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_match_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" UUID,
    "actor_membership_id" UUID,
    "actor_context" "SessionContext",
    "session_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "prev_hash" TEXT,
    "hash" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT,
    "payload" JSONB NOT NULL,
    "actor" JSONB,
    "request_id" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("scope","key")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "provider_template_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "template_key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL,
    "recipient_hash" TEXT NOT NULL,
    "recipient_masked" TEXT NOT NULL,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_party_id_key" ON "organizations"("party_id");

-- CreateIndex
CREATE INDEX "organizations_type_status_idx" ON "organizations"("type", "status");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "memberships_organization_id_status_idx" ON "memberships"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_role_key" ON "memberships"("user_id", "organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_channel_identifier_hash_status_idx" ON "invitations"("channel", "identifier_hash", "status");

-- CreateIndex
CREATE INDEX "invitations_organization_id_status_idx" ON "invitations"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_party_id_key" ON "users"("party_id");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "user_logins_user_id_idx" ON "user_logins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_logins_method_identifier_hash_key" ON "user_logins"("method", "identifier_hash");

-- CreateIndex
CREATE INDEX "otp_challenges_identifier_hash_purpose_created_at_idx" ON "otp_challenges"("identifier_hash", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_membership_id_idx" ON "sessions"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "parties_kind_status_idx" ON "parties"("kind", "status");

-- CreateIndex
CREATE INDEX "party_contacts_type_value_hash_idx" ON "party_contacts"("type", "value_hash");

-- CreateIndex
CREATE UNIQUE INDEX "party_contacts_party_id_type_value_hash_key" ON "party_contacts"("party_id", "type", "value_hash");

-- CreateIndex
CREATE INDEX "party_identifiers_type_value_hash_idx" ON "party_identifiers"("type", "value_hash");

-- CreateIndex
CREATE UNIQUE INDEX "party_identifiers_party_id_type_key" ON "party_identifiers"("party_id", "type");

-- CreateIndex
CREATE INDEX "party_relationships_from_party_id_idx" ON "party_relationships"("from_party_id");

-- CreateIndex
CREATE INDEX "party_relationships_to_party_id_idx" ON "party_relationships"("to_party_id");

-- CreateIndex
CREATE INDEX "party_merges_source_party_id_idx" ON "party_merges"("source_party_id");

-- CreateIndex
CREATE INDEX "party_merges_target_party_id_idx" ON "party_merges"("target_party_id");

-- CreateIndex
CREATE INDEX "party_match_reviews_status_created_at_idx" ON "party_match_reviews"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_seq_key" ON "audit_events"("seq");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_idx" ON "audit_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_action_occurred_at_idx" ON "audit_events"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_occurred_at_idx" ON "outbox_events"("published_at", "occurred_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_locale_key" ON "notification_templates"("key", "channel", "locale");

-- CreateIndex
CREATE INDEX "notification_deliveries_recipient_hash_requested_at_idx" ON "notification_deliveries"("recipient_hash", "requested_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_requested_at_idx" ON "notification_deliveries"("status", "requested_at");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_contacts" ADD CONSTRAINT "party_contacts_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_identifiers" ADD CONSTRAINT "party_identifiers_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_relationships" ADD CONSTRAINT "party_relationships_from_party_id_fkey" FOREIGN KEY ("from_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_relationships" ADD CONSTRAINT "party_relationships_to_party_id_fkey" FOREIGN KEY ("to_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
