import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** 不允许改 provinceCode / cityName —— 改了会动 lng/lat 影响散点位置 */
export class UpdateVisitDto {
  @IsOptional() @IsDateString() visitDate?: string;
  @IsOptional() @IsString() @MaxLength(128) department?: string;
  @IsOptional() @IsString() @MaxLength(64) contactPerson?: string;
  @IsOptional() @IsString() @MaxLength(64) contactTitle?: string | null;
  @IsOptional() @IsString() outcomeSummary?: string;
  @IsOptional() @IsEnum(['red', 'yellow', 'green']) color?: 'red' | 'yellow' | 'green';
  @IsOptional() @IsBoolean() followUp?: boolean;
}
