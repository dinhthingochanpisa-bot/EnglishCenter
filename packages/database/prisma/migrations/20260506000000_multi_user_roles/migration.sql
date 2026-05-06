CREATE TABLE "UserRole" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRoleCenter" (
  "userRoleId" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,

  CONSTRAINT "UserRoleCenter_pkey" PRIMARY KEY ("userRoleId", "centerId")
);

CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserRoleCenter"
  ADD CONSTRAINT "UserRoleCenter_userRoleId_fkey"
  FOREIGN KEY ("userRoleId") REFERENCES "UserRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleCenter"
  ADD CONSTRAINT "UserRoleCenter_centerId_fkey"
  FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "UserRole" ("id", "userId", "roleId", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT md5("id" || ':' || "roleId"), "id", "roleId", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRoleCenter" ("userRoleId", "centerId")
SELECT ur."id", uc."centerId"
FROM "UserRole" ur
JOIN "UserCenter" uc ON uc."userId" = ur."userId"
ON CONFLICT ("userRoleId", "centerId") DO NOTHING;
