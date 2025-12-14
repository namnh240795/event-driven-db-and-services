import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class EnqueueMessageDto {
  @ApiProperty({
    description: 'Arbitrary JSON payload for the queue message',
    type: 'object',
    additionalProperties: true,
    example: { userId: '123', operation: 'sync' },
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Idempotency key used for deduplication (ignored when queue dedupe is disabled)',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  deduplicationKey?: string;
}
