import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
}
