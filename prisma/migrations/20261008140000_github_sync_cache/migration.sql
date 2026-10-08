-- AlterTable
ALTER TABLE "project" ADD COLUMN     "githubSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_package" ADD COLUMN     "githubPullRequests" JSONB;

