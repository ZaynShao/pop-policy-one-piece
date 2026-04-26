import { UserRoleCode } from '@pop/shared-types';

/**
 * 工作台 sidebar tab 定义(对应 UI-LAYOUT-V1 §3.2 R2-② + 5 角色矩阵)
 *
 * sidebar = view-local 视图 ② 的 tab 切换器(R2 v1 翻车点钉死,
 * UI-LAYOUT-V1 §1.4 ❌1)。
 *
 * sys_admin 在开发期可见全 tab(对齐 V0.2 Dashboard 现状,生产严格按权限矩阵)。
 */
export interface ConsoleTab {
  key: string;
  label: string;
  /** 父项 tab(如「关系档案」),自身不可点击;子项 path 才路由 */
  isGroup?: boolean;
  parent?: string;
  path?: string;
  roles: readonly UserRoleCode[];
}

const ALL_BUSINESS_ROLES = [
  UserRoleCode.LocalGa,
  UserRoleCode.Lead,
  UserRoleCode.Pmo,
  UserRoleCode.CentralGa,
] as const;

const SYS_ADMIN = UserRoleCode.SysAdmin;

export const CONSOLE_TABS: ConsoleTab[] = [
  { key: 'dashboard', label: '综合看板', path: '/console/dashboard', roles: [UserRoleCode.Lead, UserRoleCode.Pmo, SYS_ADMIN] },
  { key: 'visits',    label: '拜访清单', path: '/console/visits',    roles: [UserRoleCode.LocalGa, SYS_ADMIN] },
  { key: 'relations', label: '关系档案', isGroup: true, roles: [...ALL_BUSINESS_ROLES, SYS_ADMIN] },
  { key: 'orgs',      label: '机构列表', path: '/console/orgs',      parent: 'relations', roles: [...ALL_BUSINESS_ROLES, SYS_ADMIN] },
  { key: 'contacts',  label: '关键人列表', path: '/console/contacts', parent: 'relations', roles: [...ALL_BUSINESS_ROLES, SYS_ADMIN] },
  { key: 'tools',     label: '工具管理',  path: '/console/tools',    roles: [UserRoleCode.CentralGa, SYS_ADMIN] },
  { key: 'themes',    label: '政策主题管理', path: '/console/themes', roles: [UserRoleCode.CentralGa, SYS_ADMIN] },
  { key: 'weekly',    label: '周观测',    path: '/console/weekly',   roles: [UserRoleCode.Lead, UserRoleCode.Pmo, SYS_ADMIN] },
  { key: 'consumption', label: '消费排行', path: '/console/consumption', roles: [UserRoleCode.Lead, UserRoleCode.Pmo, UserRoleCode.CentralGa, SYS_ADMIN] },
  { key: 'pins',      label: '图钉清单',  path: '/console/pins',     roles: [UserRoleCode.Lead, UserRoleCode.Pmo, SYS_ADMIN] },
  { key: 'export',    label: '导出中心',  path: '/console/export',   roles: [UserRoleCode.Lead, UserRoleCode.Pmo, SYS_ADMIN] },
  { key: 'my-consumption', label: '我的消费记录', path: '/console/my-consumption', roles: [UserRoleCode.LocalGa, SYS_ADMIN] },
];

export function visibleTabsForRole(roleCode: UserRoleCode): ConsoleTab[] {
  return CONSOLE_TABS.filter((t) => t.roles.includes(roleCode));
}

/** 角色进入 /console 时默认 tab(对齐 ROLE_HOME) */
export const CONSOLE_DEFAULT_BY_ROLE: Record<UserRoleCode, string> = {
  [UserRoleCode.LocalGa]: '/console/visits',
  [UserRoleCode.Lead]: '/console/dashboard',
  [UserRoleCode.Pmo]: '/console/dashboard',
  [UserRoleCode.CentralGa]: '/console/consumption',
  [UserRoleCode.SysAdmin]: '/console/dashboard',
};
