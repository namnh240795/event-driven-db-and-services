import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

const mockQueueService = () => ({
  createQueue: jest.fn(),
  listQueues: jest.fn(),
  getQueue: jest.fn(),
  updateQueue: jest.fn(),
  enqueueMessage: jest.fn(),
  leaseMessage: jest.fn(),
  acknowledgeMessage: jest.fn(),
  releaseMessage: jest.fn(),
});

describe('QueueController', () => {
  let controller: QueueController;
  let service: jest.Mocked<QueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useFactory: mockQueueService,
        },
      ],
    }).compile();

    controller = module.get<QueueController>(QueueController);
    service = module.get(QueueService) as jest.Mocked<QueueService>;
  });

  it('creates a queue', async () => {
    const dto = { name: 'primary' } as any;
    const expected = { id: 'uuid', name: 'primary' } as any;
    service.createQueue.mockResolvedValue(expected);

    await expect(controller.create(dto)).resolves.toBe(expected);
    expect(service.createQueue).toHaveBeenCalledWith(dto);
  });

  it('throws when lease has no messages', async () => {
    service.leaseMessage.mockResolvedValue(null);
    await expect(controller.lease('uuid', {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
