import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListGovOrgDto {
  @IsOptional() @IsString() @MaxLength(6) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(50) cityName?: string;

  @IsOptional() @IsEnum(['national', 'provincial', 'municipal', 'district'])
  level?: 'national' | 'provincial' | 'municipal' | 'district';

  @IsOptional() @IsString() @MaxLength(80) search?: string;

  @IsOptional() @IsBooleanString() withDeleted?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
