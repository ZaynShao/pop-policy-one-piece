import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGovOrgDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() @MaxLength(30)
  shortName?: string;

  @IsString() @IsNotEmpty() @MaxLength(6)
  provinceCode!: string;

  @IsString() @IsNotEmpty() @MaxLength(50)
  cityName!: string;

  @IsOptional() @IsString() @MaxLength(50)
  districtName?: string;

  @IsEnum(['national', 'provincial', 'municipal', 'district'])
  level!: 'national' | 'provincial' | 'municipal' | 'district';

  @IsOptional() @IsUUID()
  parentOrgId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @IsString({ each: true })
  functionTags?: string[];

  @IsOptional() @IsString() @MaxLength(200)
  address?: string;
}
