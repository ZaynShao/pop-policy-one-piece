import { UserRoleCode } from '@pop/shared-types';

/**
 * 5 角色默认首屏(对应 PRD §6.2 + UI-LAYOUT-V1 §3.4)
 *
 * 用途两处:
 * 1. 登录后路由 `/` 重定向(RootRedirect)
 * 2. 顶栏 Logo 点击(AppShell)— UI-LAYOUT-V1 §1.5 ⚠️3 用户拍
 */
export const ROLE_HOME: Record<UserRoleCode, string> = {
  [UserRoleCode.LocalGa]: '/map/local',
  [UserRoleCode.Lead]: '/console/dashboard',
  [UserRoleCode.Pmo]: '/console/dashboard',
  [UserRoleCode.CentralGa]: '/console/consumption',
  [UserRoleCode.SysAdmin]: '/admin/users',
};

export function homeForRole(roleCode: UserRoleCode): string {
  return ROLE_HOME[roleCode] ?? '/map/local';
}
