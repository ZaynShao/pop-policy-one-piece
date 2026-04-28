import { IsEnum } from 'class-validator';
import { UserRoleCode } from '@pop/shared-types';

export class ChangeRoleDto {
  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;
}
