/*
  Warnings:

  - The primary key for the `queue_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `dead_letter_of_id` column on the `queue_messages` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `queues` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `dead_letter_queue_id` column on the `queues` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `id` on the `queue_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `queue_id` on the `queue_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `origin_queue_id` on the `queue_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `queues` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "queue_messages" DROP CONSTRAINT "queue_messages_dead_letter_of_id_fkey";

-- DropForeignKey
ALTER TABLE "queue_messages" DROP CONSTRAINT "queue_messages_origin_queue_id_fkey";

-- DropForeignKey
ALTER TABLE "queue_messages" DROP CONSTRAINT "queue_messages_queue_id_fkey";

-- DropForeignKey
ALTER TABLE "queues" DROP CONSTRAINT "queues_dead_letter_queue_id_fkey";

-- AlterTable
ALTER TABLE "queue_messages" DROP CONSTRAINT "queue_messages_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "queue_id",
ADD COLUMN     "queue_id" UUID NOT NULL,
DROP COLUMN "origin_queue_id",
ADD COLUMN     "origin_queue_id" UUID NOT NULL,
DROP COLUMN "dead_letter_of_id",
ADD COLUMN     "dead_letter_of_id" UUID,
ADD CONSTRAINT "queue_messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "queues" DROP CONSTRAINT "queues_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "dead_letter_queue_id",
ADD COLUMN     "dead_letter_queue_id" UUID,
ADD CONSTRAINT "queues_pkey" PRIMARY KEY ("id");

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
