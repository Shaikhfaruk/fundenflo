-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
