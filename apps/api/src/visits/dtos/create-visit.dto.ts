import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVisitDto {
  @IsDateString()
  visitDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  department!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  contactPerson!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactTitle?: string;

  @IsString()
  @IsNotEmpty()
  outcomeSummary!: string;

  @IsEnum(['red', 'yellow', 'green'])
  color!: 'red' | 'yellow' | 'green';

  @IsBoolean()
  followUp!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  provinceCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  cityName!: string;
}
