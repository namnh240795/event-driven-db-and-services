import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  $Enums,
  queue,
  queue_message,
} from '../generated/prisma/client';
import { PrismaService } from './prisma.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { EnqueueMessageDto } from './dto/enqueue-message.dto';
import { LeaseMessageDto } from './dto/lease-message.dto';
import { ReleaseMessageDto } from './dto/release-message.dto';

type QueueModel = queue;
type QueueMessageModel = queue_message;

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async createQueue(dto: CreateQueueDto): Promise<QueueModel> {
    await this.ensureDeadLetterExists(dto.deadLetterQueueId);

    return this.prisma.queue.create({
      data: {
        name: dto.name,
        deduplication_enabled: dto.deduplicationEnabled ?? true,
        deduplication_window_seconds: dto.deduplicationWindowSeconds ?? 300,
        visibility_timeout_seconds: dto.visibilityTimeoutSeconds ?? 30,
        max_delivery_attempts: dto.maxDeliveryAttempts ?? 5,
        dead_letter_queue_id: dto.deadLetterQueueId ?? null,
      },
    });
  }

  async listQueues(): Promise<QueueModel[]> {
    return this.prisma.queue.findMany({
      orderBy: { created_at: 'asc' },
    });
  }

  async getQueue(queueId: string): Promise<QueueModel> {
    return this.ensureQueue(queueId);
  }

  async updateQueue(
    queueId: string,
    dto: UpdateQueueDto,
  ): Promise<QueueModel> {
    await this.ensureQueue(queueId);

    if (dto.deadLetterQueueId === queueId) {
      throw new BadRequestException('Queue cannot dead-letter to itself');
    }

    await this.ensureDeadLetterExists(dto.deadLetterQueueId);

    return this.prisma.queue.update({
      where: { id: queueId },
      data: {
        name: dto.name,
        deduplication_enabled: dto.deduplicationEnabled,
        deduplication_window_seconds: dto.deduplicationWindowSeconds,
        visibility_timeout_seconds: dto.visibilityTimeoutSeconds,
        max_delivery_attempts: dto.maxDeliveryAttempts,
        dead_letter_queue_id:
          dto.deadLetterQueueId === undefined ? undefined : dto.deadLetterQueueId,
      },
    });
  }

  async enqueueMessage(
    queueId: string,
    dto: EnqueueMessageDto,
  ): Promise<QueueMessageModel> {
    const queue = await this.ensureQueue(queueId);

    if (queue.deduplication_enabled && dto.deduplicationKey) {
      const existing = await this.prisma.queue_message.findFirst({
        where: {
          queue_id: queueId,
          deduplication_key: dto.deduplicationKey,
          deduplication_expires_at: { gt: new Date() },
        },
      });

      if (existing) {
        throw new ConflictException(
          'Message with the same deduplication key is still active',
        );
      }
    }

    const deduplicationExpiresAt =
      queue.deduplication_enabled && dto.deduplicationKey
        ? this.addSeconds(new Date(), queue.deduplication_window_seconds)
        : null;

    return this.prisma.queue_message.create({
      data: {
        queue_id: queueId,
        origin_queue_id: queueId,
        payload: dto.payload as Prisma.InputJsonValue,
        deduplication_key: dto.deduplicationKey ?? null,
        deduplication_expires_at: deduplicationExpiresAt,
        status: $Enums.queue_message_status.QUEUED,
      },
    });
  }

  async leaseMessage(
    queueId: string,
    dto: LeaseMessageDto,
  ): Promise<QueueMessageModel | null> {
    const queue = await this.ensureQueue(queueId);
    const now = new Date();
    const visibilitySeconds =
      dto.visibilityTimeoutSeconds ?? queue.visibility_timeout_seconds;

    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.queue_message.findFirst({
        where: {
          queue_id: queueId,
          available_at: { lte: now },
          OR: [
            { status: $Enums.queue_message_status.QUEUED },
            {
              status: $Enums.queue_message_status.IN_FLIGHT,
              locked_until: { lt: now },
            },
          ],
        },
        orderBy: [{ available_at: 'asc' }, { created_at: 'asc' }],
      });

      if (!candidate) {
        return null;
      }

      return tx.queue_message.update({
        where: { id: candidate.id },
        data: {
          status: $Enums.queue_message_status.IN_FLIGHT,
          locked_until: this.addSeconds(now, visibilitySeconds),
          delivery_attempts: { increment: 1 },
        },
      });
    });
  }

  async acknowledgeMessage(
    queueId: string,
    messageId: string,
  ): Promise<QueueMessageModel> {
    await this.ensureQueue(queueId);
    const message = await this.prisma.queue_message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.queue_id !== queueId) {
      throw new NotFoundException('Message not found in this queue');
    }

    return this.prisma.queue_message.update({
      where: { id: messageId },
      data: {
        status: $Enums.queue_message_status.COMPLETED,
        locked_until: null,
        last_error: null,
      },
    });
  }

  async releaseMessage(
    queueId: string,
    messageId: string,
    dto: ReleaseMessageDto,
  ): Promise<QueueMessageModel> {
    const queue = await this.ensureQueue(queueId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.queue_message.findUnique({
        where: { id: messageId },
      });

      if (!message || message.queue_id !== queueId) {
        throw new NotFoundException('Message not found in this queue');
      }

      if (message.status !== $Enums.queue_message_status.IN_FLIGHT) {
        throw new BadRequestException(
          'Only in-flight messages can be released',
        );
      }

      if (message.delivery_attempts >= queue.max_delivery_attempts) {
        return this.routeToDeadLetter(queue, message, dto.reason, tx);
      }

      const availableAt = this.addSeconds(now, dto.delaySeconds ?? 0);

      return tx.queue_message.update({
        where: { id: messageId },
        data: {
          status: $Enums.queue_message_status.QUEUED,
          locked_until: null,
          available_at: availableAt,
          last_error: dto.reason ?? null,
        },
      });
    });
  }

  private async routeToDeadLetter(
    queue: QueueModel,
    message: QueueMessageModel,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<QueueMessageModel> {
    const now = new Date();

    if (!queue.dead_letter_queue_id) {
      return tx.queue_message.update({
        where: { id: message.id },
        data: {
          status: $Enums.queue_message_status.DEAD_LETTERED,
          locked_until: null,
          dead_lettered_at: now,
          last_error: reason ?? null,
        },
      });
    }

    const dlq = await tx.queue.findUnique({
      where: { id: queue.dead_letter_queue_id },
    });

    if (!dlq) {
      throw new NotFoundException(
        'Configured dead-letter queue could not be found',
      );
    }

    const payloadCopy =
      message.payload === null
        ? Prisma.JsonNull
        : (message.payload as Prisma.InputJsonValue);

    const deadLetterEntry = await tx.queue_message.create({
      data: {
        queue_id: dlq.id,
        origin_queue_id: message.origin_queue_id,
        payload: payloadCopy,
        deduplication_key: message.deduplication_key,
        deduplication_expires_at: message.deduplication_expires_at,
        status: $Enums.queue_message_status.DEAD_LETTERED,
        dead_letter_of_id: message.id,
        dead_lettered_at: now,
        last_error: reason ?? null,
      },
    });

    await tx.queue_message.update({
      where: { id: message.id },
      data: {
        status: $Enums.queue_message_status.DEAD_LETTERED,
        locked_until: null,
        dead_lettered_at: now,
        last_error: reason ?? null,
      },
    });

    return deadLetterEntry;
  }

  private async ensureQueue(queueId: string): Promise<QueueModel> {
    const queue = await this.prisma.queue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    return queue;
  }

  private async ensureDeadLetterExists(queueId?: string): Promise<void> {
    if (!queueId) {
      return;
    }

    const exists = await this.prisma.queue.findUnique({
      where: { id: queueId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Dead-letter queue not found');
    }
  }

  private addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }
}
