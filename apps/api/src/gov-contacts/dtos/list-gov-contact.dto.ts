import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListGovContactDto {
  @IsOptional() @IsUUID() orgId?: string;
  @IsOptional() @IsUUID() ownerUserId?: string;

  @IsOptional() @IsEnum(['core', 'important', 'normal'])
  tier?: 'core' | 'important' | 'normal';

  @IsOptional() @IsString() @MaxLength(50) search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
