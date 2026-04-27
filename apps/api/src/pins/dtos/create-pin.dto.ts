import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';
  // status 不接受外部传 — service 强制初始化为 in_progress

  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  provinceCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  cityName!: string;
}
