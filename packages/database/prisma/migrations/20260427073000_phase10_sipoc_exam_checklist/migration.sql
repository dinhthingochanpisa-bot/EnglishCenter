-- Phase 10 SIPOC B10-B11: exam registration and reminder checklist

CREATE TYPE "ExamRegistrationStatus" AS ENUM (
  'NOT_STARTED',
  'PROPOSED',
  'CONFIRMED',
  'REGISTERED',
  'CANCELLED'
);

ALTER TABLE "StudentExamEvent"
  ADD COLUMN "registrationStatus" "ExamRegistrationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "examFeeConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "documentsChecked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderTMinus7Sent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderTMinus3Sent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderTMinus1Sent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "arrivalConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "registrationNotes" TEXT;
