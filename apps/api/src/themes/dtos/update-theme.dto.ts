import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  regionScope?: string | null;
}
