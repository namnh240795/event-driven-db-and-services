import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { EnqueueMessageDto } from './dto/enqueue-message.dto';
import { LeaseMessageDto } from './dto/lease-message.dto';
import { ReleaseMessageDto } from './dto/release-message.dto';

@ApiTags('queues')
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  @ApiOperation({ summary: 'Create a queue with optional DLQ configuration' })
  @ApiResponse({ status: HttpStatus.CREATED })
  create(@Body() dto: CreateQueueDto) {
    return this.queueService.createQueue(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all queues' })
  findAll() {
    return this.queueService.listQueues();
  }

  @Get(':queueId')
  @ApiOperation({ summary: 'Fetch a single queue by id' })
  findOne(@Param('queueId', ParseUUIDPipe) queueId: string) {
    return this.queueService.getQueue(queueId);
  }

  @Patch(':queueId')
  @ApiOperation({ summary: 'Update queue configuration' })
  update(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Body() dto: UpdateQueueDto,
  ) {
    return this.queueService.updateQueue(queueId, dto);
  }

  @Post(':queueId/messages')
  @ApiOperation({ summary: 'Enqueue a new message' })
  enqueue(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Body() dto: EnqueueMessageDto,
  ) {
    return this.queueService.enqueueMessage(queueId, dto);
  }

  @Post(':queueId/messages/lease')
  @ApiOperation({
    summary: 'Lease the next available message while honoring visibility timeout',
  })
  @HttpCode(HttpStatus.OK)
  async lease(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Body() dto: LeaseMessageDto,
  ) {
    const message = await this.queueService.leaseMessage(queueId, dto);
    if (!message) {
      throw new NotFoundException('No messages available');
    }
    return message;
  }

  @Post(':queueId/messages/:messageId/ack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a message and mark it as completed' })
  acknowledge(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.queueService.acknowledgeMessage(queueId, messageId);
  }

  @Post(':queueId/messages/:messageId/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Release a failed message back to the queue or dead-letter it when attempts exceed max',
  })
  release(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReleaseMessageDto,
  ) {
    return this.queueService.releaseMessage(queueId, messageId, dto);
  }
}
