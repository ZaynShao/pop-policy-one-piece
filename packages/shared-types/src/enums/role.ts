/**
 * 用户角色 code(对应 PRD §4.2.2 + §5 权限矩阵)
 *
 * 5 角色(PRD 1.1-1.5):
 * - lead       GA 负责人
 * - pmo        PMO
 * - local_ga   属地 GA
 * - central_ga 中台 GA
 * - sys_admin  系统管理员
 *
 * 注意:role_code 作为权限判断的**唯一稳定 key**,字符串值不可变。
 * 如需调整显示名,改前端 role-display-name map,不改此 enum。
 *
 * MVP 严格单角色(PRD §4.2.2):一个 user 只能有 1 个 UserRole;
 * 结构允许未来 N:M,业务层 enforce。
 */
export enum UserRoleCode {
  Lead = 'lead',
  Pmo = 'pmo',
  LocalGa = 'local_ga',
  CentralGa = 'central_ga',
  SysAdmin = 'sys_admin',
}

export const USER_ROLE_CODES = Object.values(UserRoleCode);
