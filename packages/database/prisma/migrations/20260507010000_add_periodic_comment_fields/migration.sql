ALTER TABLE "ProgressNote"
  ADD COLUMN "periodType" TEXT,
  ADD COLUMN "periodKey" TEXT,
  ADD COLUMN "strengths" TEXT,
  ADD COLUMN "improvements" TEXT,
  ADD COLUMN "nextSteps" TEXT;

CREATE INDEX "ProgressNote_studentId_classId_periodType_periodKey_idx"
  ON "ProgressNote"("studentId", "classId", "periodType", "periodKey");
