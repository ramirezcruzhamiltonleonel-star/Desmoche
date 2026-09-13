-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "chipBalance" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stakeType" TEXT NOT NULL,
    "ante" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandHistoryRecord" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "winnerUserId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandHistoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandHistoryPlayer" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "isWinner" BOOLEAN NOT NULL,
    "chipsDelta" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HandHistoryPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OneTimeCode_email_idx" ON "OneTimeCode"("email");

-- AddForeignKey
ALTER TABLE "HandHistoryRecord" ADD CONSTRAINT "HandHistoryRecord_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandHistoryPlayer" ADD CONSTRAINT "HandHistoryPlayer_handId_fkey" FOREIGN KEY ("handId") REFERENCES "HandHistoryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandHistoryPlayer" ADD CONSTRAINT "HandHistoryPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

