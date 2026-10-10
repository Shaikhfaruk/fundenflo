-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_one_channel" CHECK ("sms" OR "email" OR "push");

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_subject_by_channel" CHECK (
  ("channel" IN ('email', 'push') AND "subject" IS NOT NULL AND length(btrim("subject")) > 0)
  OR ("channel" NOT IN ('email', 'push') AND "subject" IS NULL)
);

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_body_present" CHECK (length(btrim("body")) > 0);
