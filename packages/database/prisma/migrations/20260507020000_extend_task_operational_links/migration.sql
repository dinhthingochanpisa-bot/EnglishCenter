ALTER TABLE "Task" ADD COLUMN "studentId" TEXT;
ALTER TABLE "Task" ADD COLUMN "contractId" TEXT;
ALTER TABLE "Task" ADD COLUMN "classId" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_studentId_idx" ON "Task"("studentId");
CREATE INDEX "Task_contractId_idx" ON "Task"("contractId");
CREATE INDEX "Task_classId_idx" ON "Task"("classId");
