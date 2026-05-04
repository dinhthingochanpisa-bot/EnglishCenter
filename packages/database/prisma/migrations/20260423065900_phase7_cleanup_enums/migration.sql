-- AlterEnum
BEGIN;
CREATE TYPE "ClassStatus_new" AS ENUM ('PLANNING', 'ACTIVE', 'FINISHED', 'CANCELLED');
ALTER TABLE "public"."Class" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Class" ALTER COLUMN "status" TYPE "ClassStatus_new" USING ("status"::text::"ClassStatus_new");
ALTER TYPE "ClassStatus" RENAME TO "ClassStatus_old";
ALTER TYPE "ClassStatus_new" RENAME TO "ClassStatus";
DROP TYPE "public"."ClassStatus_old";
ALTER TABLE "Class" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StudentStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'HOLD', 'COMPLETED', 'DROPPED', 'RENEWAL_CANDIDATE');
ALTER TABLE "public"."Student" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "status" TYPE "StudentStatus_new" USING ("status"::text::"StudentStatus_new");
ALTER TYPE "StudentStatus" RENAME TO "StudentStatus_old";
ALTER TYPE "StudentStatus_new" RENAME TO "StudentStatus";
DROP TYPE "public"."StudentStatus_old";
ALTER TABLE "Student" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

