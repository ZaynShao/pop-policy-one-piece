import type { UserRoleCode } from '../enums/role';

/** 头像下拉「修改资料」/「基本信息」tab */
export interface UpdateProfileInput {
  displayName: string;
}

/** 头像下拉「修改资料」/「修改密码」tab — 必须输旧密码 */
export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

/** sysadmin 在 /admin/users「新建用户」 */
export interface CreateUserInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
  roleCode: UserRoleCode;
}

/** sysadmin 在 /admin/users「编辑用户」(不改 username/role/password) */
export interface UpdateUserInput {
  displayName?: string;
  email?: string;
}

/** sysadmin 重置任意用户密码(无需旧密码 — admin override) */
export interface ResetPasswordInput {
  newPassword: string;
}

/** sysadmin 改用户角色(走 DELETE+INSERT user_roles) */
export interface ChangeRoleInput {
  roleCode: UserRoleCode;
}
