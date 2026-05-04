-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClassStatus" ADD VALUE 'PLANNING';
ALTER TYPE "ClassStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "ClassStatus" ADD VALUE 'FINISHED';
ALTER TYPE "ClassStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudentStatus" ADD VALUE 'PENDING';
ALTER TYPE "StudentStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "StudentStatus" ADD VALUE 'HOLD';
ALTER TYPE "StudentStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "StudentStatus" ADD VALUE 'RENEWAL_CANDIDATE';

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "createdAt" DROP DEFAULT;
