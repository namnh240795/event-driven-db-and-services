/*
  Warnings:

  - You are about to drop the `Queue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueueMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "queue_message_status" AS ENUM ('QUEUED', 'IN_FLIGHT', 'COMPLETED', 'DEAD_LETTERED');

-- DropForeignKey
ALTER TABLE "Queue" DROP CONSTRAINT "Queue_deadLetterQueueId_fkey";

-- DropForeignKey
ALTER TABLE "QueueMessage" DROP CONSTRAINT "QueueMessage_deadLetterOfId_fkey";

-- DropForeignKey
ALTER TABLE "QueueMessage" DROP CONSTRAINT "QueueMessage_originQueueId_fkey";

-- DropForeignKey
ALTER TABLE "QueueMessage" DROP CONSTRAINT "QueueMessage_queueId_fkey";

-- DropTable
DROP TABLE "Queue";

-- DropTable
DROP TABLE "QueueMessage";

-- DropEnum
DROP TYPE "QueueMessageStatus";

-- CreateTable
CREATE TABLE "queues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deduplication_enabled" BOOLEAN NOT NULL DEFAULT true,
    "deduplication_window_seconds" INTEGER NOT NULL DEFAULT 300,
    "visibility_timeout_seconds" INTEGER NOT NULL DEFAULT 30,
    "max_delivery_attempts" INTEGER NOT NULL DEFAULT 5,
    "dead_letter_queue_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_messages" (
    "id" TEXT NOT NULL,
    "queue_id" TEXT NOT NULL,
    "origin_queue_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "deduplication_key" TEXT,
    "deduplication_expires_at" TIMESTAMP(3),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "queue_message_status" NOT NULL DEFAULT 'QUEUED',
    "last_error" TEXT,
    "dead_letter_of_id" TEXT,
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "queues_name_key" ON "queues"("name");

-- CreateIndex
CREATE INDEX "queue_messages_queue_id_status_available_at_idx" ON "queue_messages"("queue_id", "status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "queue_messages_queue_id_deduplication_key_key" ON "queue_messages"("queue_id", "deduplication_key");

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_dead_letter_queue_id_fkey" FOREIGN KEY ("dead_letter_queue_id") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_messages" ADD CONSTRAINT "queue_messages_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_messages" ADD CONSTRAINT "queue_messages_origin_queue_id_fkey" FOREIGN KEY ("origin_queue_id") REFERENCES "queues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_messages" ADD CONSTRAINT "queue_messages_dead_letter_of_id_fkey" FOREIGN KEY ("dead_letter_of_id") REFERENCES "queue_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
