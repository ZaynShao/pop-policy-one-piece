import { IsString, MinLength, MaxLength, IsEmail, IsEnum } from 'class-validator';
import { UserRoleCode } from '@pop/shared-types';

export class CreateUserDto {
  @IsString() @MinLength(1) @MaxLength(32)
  username!: string;

  @IsString() @MinLength(1) @MaxLength(32)
  displayName!: string;

  @IsEmail() @MaxLength(128)
  email!: string;

  @IsString() @MinLength(6) @MaxLength(64)
  password!: string;

  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;
}
