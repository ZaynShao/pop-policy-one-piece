import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGovContactDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(10)
  gender?: string | null;

  @IsOptional() @IsString() @MaxLength(50) title?: string;

  @IsOptional() @IsEnum(['core', 'important', 'normal'])
  tier?: 'core' | 'important' | 'normal';

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(50)
  wechat?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  preferenceNotes?: string | null;

  @IsOptional() @IsUUID() ownerUserId?: string;
}
