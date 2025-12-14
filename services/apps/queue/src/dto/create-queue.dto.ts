import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateQueueDto {
  @ApiProperty({ description: 'Human-friendly queue name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Turn deduplication on/off per queue',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deduplicationEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Deduplication window in seconds',
    default: 300,
    minimum: 0,
    maximum: 86400,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  deduplicationWindowSeconds?: number;

  @ApiPropertyOptional({
    description: 'Visibility timeout for leased messages (seconds)',
    default: 30,
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  visibilityTimeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Maximum deliveries before routing to the DLQ',
    default: 5,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxDeliveryAttempts?: number;

  @ApiPropertyOptional({
    description: 'Target queue id for dead-letter routing',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  deadLetterQueueId?: string;
}
