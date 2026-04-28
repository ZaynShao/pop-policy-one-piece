import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ThemeTemplate } from '@pop/shared-types';

export class CreateThemeDto {
  @IsString()
  @MaxLength(100)
  title!: string;

  @IsEnum(['main', 'risk'])
  template!: ThemeTemplate;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  regionScope?: string;
}
