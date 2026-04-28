import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString() @MinLength(6) @MaxLength(64)
  newPassword!: string;
}
