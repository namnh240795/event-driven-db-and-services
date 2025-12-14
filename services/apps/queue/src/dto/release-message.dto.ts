import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReleaseMessageDto {
  @ApiPropertyOptional({
    description: 'Human readable reason stored on the failed message',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Delay (seconds) before the message becomes visible again. Defaults to immediate retry.',
    minimum: 0,
    maximum: 3600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3600)
  delaySeconds?: number;
}
