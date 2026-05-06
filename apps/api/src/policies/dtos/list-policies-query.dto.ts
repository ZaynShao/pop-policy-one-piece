import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PolicyLevel } from '@pop/shared-types';

export class ListPoliciesQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  topic!: string;

  @IsOptional() @IsString() @MaxLength(6)
  provinceCode?: string;

  @IsOptional() @IsString() @MaxLength(50)
  cityName?: string;

  @IsOptional()
  @IsEnum(['national', 'provincial', 'municipal', 'district'])
  level?: PolicyLevel;
}
