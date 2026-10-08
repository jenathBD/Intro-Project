-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "githubLogin" TEXT;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "githubRepo" TEXT;

-- AlterTable
ALTER TABLE "work_package" ADD COLUMN     "epicId" TEXT,
ADD COLUMN     "githubNumber" INTEGER,
ADD COLUMN     "githubState" TEXT,
ADD COLUMN     "githubSyncedAt" TIMESTAMP(3),
ALTER COLUMN "estimateHours" DROP NOT NULL,
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "endDate" DROP NOT NULL,
ALTER COLUMN "responsibleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "epic" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "githubNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "epic_projectId_githubNumber_key" ON "epic"("projectId", "githubNumber");

-- CreateIndex
CREATE UNIQUE INDEX "employee_githubLogin_key" ON "employee"("githubLogin");

-- CreateIndex
CREATE INDEX "work_package_epicId_idx" ON "work_package"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "work_package_projectId_githubNumber_key" ON "work_package"("projectId", "githubNumber");

-- AddForeignKey
ALTER TABLE "epic" ADD CONSTRAINT "epic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package" ADD CONSTRAINT "work_package_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

