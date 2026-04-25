/**
 * 管理后台菜单(对应 UI-LAYOUT-V1 §3.3 R2-③ + PRD §6.1:1564-1569)
 *
 * 视图 ③ 独立路由 /admin/*,sys_admin only(UI-LAYOUT-V1 §1.4 ❌7)。
 */
export interface AdminPage {
  key: string;
  label: string;
  path: string;
  /** 备注引用 H 模块编号(PRD §3.8) */
  ref?: string;
}

export const ADMIN_PAGES: AdminPage[] = [
  { key: 'users',    label: '用户管理', path: '/admin/users',    ref: 'H1' },
  { key: 'roles',    label: '角色分配', path: '/admin/roles',    ref: 'H2' },
  { key: 'params',   label: '系统参数', path: '/admin/params',   ref: 'H3' },
  { key: 'audit',    label: '审计日志', path: '/admin/audit',    ref: 'H5' },
  { key: 'tickets',  label: '工单处理', path: '/admin/tickets' },
  { key: 'export',   label: '数据导出', path: '/admin/export' },
];
