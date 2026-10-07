-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('mock', 'clockify');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('fixed', 'byTitle');

-- CreateTable
CREATE TABLE "title" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardRate" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'fixed',
    "hourlyRate" DECIMAL(10,2),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_title_rate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_title_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_package" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "estimateHours" DECIMAL(7,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "weeklyCapacity" DECIMAL(5,2) NOT NULL,
    "clockifyUserId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(7,2) NOT NULL,
    "titleId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'mock',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remaining_update" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "remainingHours" DECIMAL(7,2) NOT NULL,
    "comment" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remaining_update_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "title_name_key" ON "title"("name");

-- CreateIndex
CREATE UNIQUE INDEX "project_title_rate_projectId_titleId_key" ON "project_title_rate"("projectId", "titleId");

-- CreateIndex
CREATE INDEX "work_package_projectId_idx" ON "work_package"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_clockifyUserId_key" ON "employee"("clockifyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_userId_key" ON "employee"("userId");

-- CreateIndex
CREATE INDEX "time_entry_workPackageId_idx" ON "time_entry"("workPackageId");

-- CreateIndex
CREATE INDEX "time_entry_employeeId_date_idx" ON "time_entry"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "time_entry_source_externalId_key" ON "time_entry"("source", "externalId");

-- CreateIndex
CREATE INDEX "allocation_weekStart_idx" ON "allocation"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_employeeId_workPackageId_weekStart_key" ON "allocation"("employeeId", "workPackageId", "weekStart");

-- CreateIndex
CREATE INDEX "remaining_update_workPackageId_createdAt_idx" ON "remaining_update"("workPackageId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_title_rate" ADD CONSTRAINT "project_title_rate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_title_rate" ADD CONSTRAINT "project_title_rate_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package" ADD CONSTRAINT "work_package_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remaining_update" ADD CONSTRAINT "remaining_update_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remaining_update" ADD CONSTRAINT "remaining_update_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
