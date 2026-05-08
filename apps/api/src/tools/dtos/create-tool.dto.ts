import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ToolType, ToolTaxonomy } from '@pop/shared-types';

export class CreateToolDto {
  @IsEnum(['document', 'interface'])
  type!: ToolType;

  @IsString()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other'])
  taxonomyTag!: ToolTaxonomy;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsObject()
  @IsOptional()
  paramTemplate?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  responseMapping?: Record<string, unknown>;
}
