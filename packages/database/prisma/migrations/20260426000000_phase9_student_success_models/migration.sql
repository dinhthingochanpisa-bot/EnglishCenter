-- Phase 9 student success and handover models.
-- This migration must run before phase10_sipoc_exam_checklist because
-- phase10 adds registration checklist fields to StudentExamEvent.

CREATE TYPE "CustomerIssueType" AS ENUM ('OBJECTION', 'COMPLAINT');
CREATE TYPE "CustomerIssueCategory" AS ENUM (
  'PRICE',
  'DISCOUNT',
  'PROMOTION',
  'PRODUCT_PROGRAM',
  'SCHEDULE',
  'CLASS_TRANSFER',
  'TEACHER_TRANSFER',
  'ACADEMIC_QUALITY',
  'SERVICE_EXPERIENCE',
  'PAYMENT',
  'FACILITY',
  'OTHER'
);
CREATE TYPE "CustomerIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CANCELLED');
CREATE TYPE "CustomerIssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SalesHandoverStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "StudentCareEventType" AS ENUM ('FIRST_LESSON', 'ATTENDANCE', 'TEACHER_COMMENT', 'RISK_WARNING', 'GENERAL');
CREATE TYPE "StudentRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "StudentCareEventStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "StudentExamType" AS ENUM ('MOCK_TEST', 'REAL_EXAM');
CREATE TYPE "StudentExamStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "StudentExamOutcome" AS ENUM ('BELOW_TARGET', 'MEET_TARGET', 'EXCEED_TARGET');
CREATE TYPE "WarrantyCaseStatus" AS ENUM ('OPEN', 'APPROVED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "PaymentSchedule"
  ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "remainingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "CustomerIssue" (
  "id" TEXT NOT NULL,
  "type" "CustomerIssueType" NOT NULL,
  "category" "CustomerIssueCategory" NOT NULL,
  "status" "CustomerIssueStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "CustomerIssuePriority" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "resolution" TEXT,
  "nextAction" TEXT,
  "dueDate" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "centerId" TEXT NOT NULL,
  "leadId" TEXT,
  "studentId" TEXT,
  "parentId" TEXT,
  "familyId" TEXT,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesHandover" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "studentId" TEXT,
  "contractId" TEXT,
  "classId" TEXT,
  "centerId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" "SalesHandoverStatus" NOT NULL DEFAULT 'PENDING',
  "profileConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "profileNotes" TEXT,
  "paymentGuideSent" BOOLEAN NOT NULL DEFAULT false,
  "paymentReceiptConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "paymentNotes" TEXT,
  "scheduleRequested" BOOLEAN NOT NULL DEFAULT false,
  "scheduleConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "schedulePreference" TEXT,
  "scheduleNotes" TEXT,
  "academicHandoverSent" BOOLEAN NOT NULL DEFAULT false,
  "academicNotes" TEXT,
  "welcomeSent" BOOLEAN NOT NULL DEFAULT false,
  "groupsAdded" BOOLEAN NOT NULL DEFAULT false,
  "zaloGroupCreated" BOOLEAN NOT NULL DEFAULT false,
  "parentConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "welcomeNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesHandover_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentCareEvent" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT,
  "createdById" TEXT NOT NULL,
  "type" "StudentCareEventType" NOT NULL,
  "riskLevel" "StudentRiskLevel",
  "title" TEXT NOT NULL,
  "content" TEXT,
  "actionPlan" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "StudentCareEventStatus" NOT NULL DEFAULT 'OPEN',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentCareEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentExamEvent" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT,
  "contractId" TEXT,
  "createdById" TEXT NOT NULL,
  "type" "StudentExamType" NOT NULL,
  "status" "StudentExamStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "score" DECIMAL(5,2),
  "targetScore" DECIMAL(5,2),
  "outcome" "StudentExamOutcome",
  "notes" TEXT,
  "actionPlan" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentExamEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarrantyCase" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "contractId" TEXT,
  "examEventId" TEXT,
  "createdById" TEXT NOT NULL,
  "status" "WarrantyCaseStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "plan" TEXT,
  "dueDate" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WarrantyCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesHandover_opportunityId_key" ON "SalesHandover"("opportunityId");
CREATE INDEX "CustomerIssue_centerId_idx" ON "CustomerIssue"("centerId");
CREATE INDEX "CustomerIssue_leadId_idx" ON "CustomerIssue"("leadId");
CREATE INDEX "CustomerIssue_studentId_idx" ON "CustomerIssue"("studentId");
CREATE INDEX "CustomerIssue_parentId_idx" ON "CustomerIssue"("parentId");
CREATE INDEX "CustomerIssue_familyId_idx" ON "CustomerIssue"("familyId");
CREATE INDEX "CustomerIssue_status_idx" ON "CustomerIssue"("status");
CREATE INDEX "CustomerIssue_priority_idx" ON "CustomerIssue"("priority");
CREATE INDEX "CustomerIssue_type_idx" ON "CustomerIssue"("type");
CREATE INDEX "SalesHandover_leadId_idx" ON "SalesHandover"("leadId");
CREATE INDEX "SalesHandover_centerId_idx" ON "SalesHandover"("centerId");
CREATE INDEX "SalesHandover_ownerId_idx" ON "SalesHandover"("ownerId");
CREATE INDEX "StudentCareEvent_studentId_idx" ON "StudentCareEvent"("studentId");
CREATE INDEX "StudentCareEvent_classId_idx" ON "StudentCareEvent"("classId");
CREATE INDEX "StudentCareEvent_type_idx" ON "StudentCareEvent"("type");
CREATE INDEX "StudentCareEvent_status_idx" ON "StudentCareEvent"("status");
CREATE INDEX "StudentCareEvent_occurredAt_idx" ON "StudentCareEvent"("occurredAt");
CREATE INDEX "StudentExamEvent_studentId_idx" ON "StudentExamEvent"("studentId");
CREATE INDEX "StudentExamEvent_classId_idx" ON "StudentExamEvent"("classId");
CREATE INDEX "StudentExamEvent_contractId_idx" ON "StudentExamEvent"("contractId");
CREATE INDEX "StudentExamEvent_type_idx" ON "StudentExamEvent"("type");
CREATE INDEX "StudentExamEvent_status_idx" ON "StudentExamEvent"("status");
CREATE INDEX "StudentExamEvent_scheduledAt_idx" ON "StudentExamEvent"("scheduledAt");
CREATE INDEX "WarrantyCase_studentId_idx" ON "WarrantyCase"("studentId");
CREATE INDEX "WarrantyCase_contractId_idx" ON "WarrantyCase"("contractId");
CREATE INDEX "WarrantyCase_status_idx" ON "WarrantyCase"("status");

ALTER TABLE "CustomerIssue" ADD CONSTRAINT "CustomerIssue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerIssue" ADD CONSTRAINT "CustomerIssue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerIssue" ADD CONSTRAINT "CustomerIssue_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerIssue" ADD CONSTRAINT "CustomerIssue_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerIssue" ADD CONSTRAINT "CustomerIssue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerIssue" ADD CONSTRAINT "CustomerIssue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCareEvent" ADD CONSTRAINT "StudentCareEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCareEvent" ADD CONSTRAINT "StudentCareEvent_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentCareEvent" ADD CONSTRAINT "StudentCareEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentExamEvent" ADD CONSTRAINT "StudentExamEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentExamEvent" ADD CONSTRAINT "StudentExamEvent_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentExamEvent" ADD CONSTRAINT "StudentExamEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentExamEvent" ADD CONSTRAINT "StudentExamEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarrantyCase" ADD CONSTRAINT "WarrantyCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarrantyCase" ADD CONSTRAINT "WarrantyCase_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarrantyCase" ADD CONSTRAINT "WarrantyCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
