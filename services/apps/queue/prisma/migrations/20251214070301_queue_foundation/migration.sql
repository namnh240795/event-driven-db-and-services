-- CreateEnum
CREATE TYPE "QueueMessageStatus" AS ENUM ('QUEUED', 'IN_FLIGHT', 'COMPLETED', 'DEAD_LETTERED');

-- CreateTable
CREATE TABLE "Queue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deduplicationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deduplicationWindowSeconds" INTEGER NOT NULL DEFAULT 300,
    "visibilityTimeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "maxDeliveryAttempts" INTEGER NOT NULL DEFAULT 5,
    "deadLetterQueueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueMessage" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "originQueueId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "deduplicationKey" TEXT,
    "deduplicationExpiresAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "status" "QueueMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "lastError" TEXT,
    "deadLetterOfId" TEXT,
    "deadLetteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Queue_name_key" ON "Queue"("name");

-- CreateIndex
CREATE INDEX "QueueMessage_queueId_status_availableAt_idx" ON "QueueMessage"("queueId", "status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueMessage_queueId_deduplicationKey_key" ON "QueueMessage"("queueId", "deduplicationKey");

-- AddForeignKey
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_deadLetterQueueId_fkey" FOREIGN KEY ("deadLetterQueueId") REFERENCES "Queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueMessage" ADD CONSTRAINT "QueueMessage_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueMessage" ADD CONSTRAINT "QueueMessage_originQueueId_fkey" FOREIGN KEY ("originQueueId") REFERENCES "Queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueMessage" ADD CONSTRAINT "QueueMessage_deadLetterOfId_fkey" FOREIGN KEY ("deadLetterOfId") REFERENCES "QueueMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
