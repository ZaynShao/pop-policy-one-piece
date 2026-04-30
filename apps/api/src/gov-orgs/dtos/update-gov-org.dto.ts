import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGovOrgDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(30)
  shortName?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(50)
  districtName?: string | null;

  @IsOptional() @IsEnum(['national', 'provincial', 'municipal', 'district'])
  level?: 'national' | 'provincial' | 'municipal' | 'district';

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  parentOrgId?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  functionTags?: string[];

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(200)
  address?: string | null;
}
