import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class LeaseMessageDto {
  @ApiPropertyOptional({
    description: 'Override visibility timeout for this lease in seconds',
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  visibilityTimeoutSeconds?: number;
}
