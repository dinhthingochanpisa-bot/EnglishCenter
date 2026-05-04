-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NURTURING', 'LOST', 'CONVERTED');
ALTER TABLE "public"."Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "public"."LeadStatus_old";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OpportunityStatus_new" AS ENUM ('OPEN', 'CHECKIN_BOOKED', 'CHECKIN_DONE', 'TEST_DONE', 'TRIAL_DONE', 'WON', 'LOST');
ALTER TABLE "public"."Opportunity" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Opportunity" ALTER COLUMN "status" TYPE "OpportunityStatus_new" USING ("status"::text::"OpportunityStatus_new");
ALTER TYPE "OpportunityStatus" RENAME TO "OpportunityStatus_old";
ALTER TYPE "OpportunityStatus_new" RENAME TO "OpportunityStatus";
DROP TYPE "public"."OpportunityStatus_old";
ALTER TABLE "Opportunity" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "prospectiveStudentName" TEXT,
ADD COLUMN     "school" TEXT,
ADD COLUMN     "target" TEXT;

-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "preferredCommunicationChannel" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "target" TEXT,
ADD COLUMN     "warningFlags" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "opportunityId" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

