import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(32)
  displayName?: string;

  @IsOptional() @IsEmail() @MaxLength(128)
  email?: string;
}
