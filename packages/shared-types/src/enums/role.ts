/**
 * 用户角色 code(对应 PRD §5 权限矩阵)
 *
 * 5 角色:
 * - sys_admin  系统管理员
 * - lead       总监/负责人
 * - pmo        PMO
 * - local_ga   地方 GA
 * - hq_ga      总部 GA
 *
 * 注意:role_code 作为权限判断的**唯一稳定 key**,字符串值不可变。
 * 如需调整显示名,改 role 表的 name 字段,不改此 enum。
 */
export enum UserRoleCode {
  SysAdmin = 'sys_admin',
  Lead = 'lead',
  Pmo = 'pmo',
  LocalGa = 'local_ga',
  HqGa = 'hq_ga',
}

export const USER_ROLE_CODES = Object.values(UserRoleCode);
