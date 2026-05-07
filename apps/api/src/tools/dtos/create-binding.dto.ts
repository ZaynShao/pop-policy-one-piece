import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { BindingTarget, RegionScope } from '@pop/shared-types';

export class CreateBindingDto {
  @IsEnum(['pin', 'visit', 'region'])
  targetType!: BindingTarget;

  @IsUUID() @IsOptional() pinId?: string;
  @IsUUID() @IsOptional() visitId?: string;
  @IsString() @IsOptional() regionCode?: string | null;
  @IsEnum(['nationwide', 'all_provinces', 'all_cities_in_province', 'all_districts_in_city', 'specific'])
  @IsOptional()
  regionScopeTag?: RegionScope;
}
