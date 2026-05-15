import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateVisitDto {
  @IsOptional()
  @IsEnum(['planned', 'completed', 'cancelled'])
  status?: 'planned' | 'completed' | 'cancelled';

  @IsOptional()
  @IsUUID()
  parentPinId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @IsOptional()
  @IsDateString()
  plannedDate?: string | null;

  @IsOptional() @IsDateString() visitDate?: string | null;
  @IsOptional() @IsString() @MaxLength(128) department?: string | null;
  @IsOptional() @IsString() @MaxLength(64) contactPerson?: string | null;
  @IsOptional() @IsString() @MaxLength(64) contactTitle?: string | null;
  @IsOptional() @IsString() outcomeSummary?: string | null;

  @IsOptional()
  @IsEnum(['red', 'yellow', 'green', 'blue'])
  color?: 'red' | 'yellow' | 'green' | 'blue' | null;

  @IsOptional() @IsBoolean() followUp?: boolean;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  orgId?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  contactId?: string | null;

  // 随行人(2026-05-12)— planned 或 completed 都可改
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  accompaniedBy?: string[];
}
