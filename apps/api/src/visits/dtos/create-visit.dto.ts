import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVisitDto {
  // β.2.5/β.3 新增
  @IsOptional()
  @IsEnum(['planned', 'completed', 'cancelled'])
  status?: 'planned' | 'completed' | 'cancelled';

  @IsOptional()
  @IsUUID()
  parentPinId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  // 业务字段(均改 optional,service 层按 status 校验必填)
  @IsOptional() @IsDateString() visitDate?: string;
  @IsOptional() @IsString() @MaxLength(128) department?: string;
  @IsOptional() @IsString() @MaxLength(64) contactPerson?: string;
  @IsOptional() @IsString() @MaxLength(64) contactTitle?: string;
  @IsOptional() @IsString() outcomeSummary?: string;

  @IsOptional()
  @IsEnum(['red', 'yellow', 'green', 'blue'])
  color?: 'red' | 'yellow' | 'green' | 'blue';

  @IsOptional() @IsBoolean() followUp?: boolean;

  // 地理(必填,用于 city center lookup)
  @IsString() @IsNotEmpty() @MaxLength(6) provinceCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) cityName!: string;
}
