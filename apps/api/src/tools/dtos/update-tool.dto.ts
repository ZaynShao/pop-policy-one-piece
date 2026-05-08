import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ToolTaxonomy } from '@pop/shared-types';

export class UpdateToolDto {
  @IsString() @MaxLength(100) @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string | null;
  @IsEnum(['ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other']) @IsOptional() taxonomyTag?: ToolTaxonomy;
  @IsString() @IsOptional() fileUrl?: string;
  @IsObject() @IsOptional() paramTemplate?: Record<string, unknown>;
  @IsObject() @IsOptional() responseMapping?: Record<string, unknown>;
}
