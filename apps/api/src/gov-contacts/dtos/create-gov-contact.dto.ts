import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGovContactDto {
  @IsString() @IsNotEmpty() @MaxLength(50) name!: string;
  @IsOptional() @IsString() @MaxLength(10) gender?: string;

  @IsUUID() orgId!: string;

  @IsString() @IsNotEmpty() @MaxLength(50) title!: string;

  @IsOptional() @IsEnum(['core', 'important', 'normal'])
  tier?: 'core' | 'important' | 'normal';

  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(50) wechat?: string;
  @IsOptional() @IsString() preferenceNotes?: string;

  @IsOptional() @IsUUID() ownerUserId?: string;
}
