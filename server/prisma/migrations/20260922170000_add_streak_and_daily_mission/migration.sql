-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "longestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastPlayedDate" TIMESTAMP(3),
ADD COLUMN     "dailyMissionClaimedDate" TIMESTAMP(3);
