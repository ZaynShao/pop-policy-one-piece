import type { UserRoleCode } from '@pop/shared-types';

export interface SidebarItem {
  path: string;
  label: string;
}

export function defaultRouteForRole(role: UserRoleCode): string {
  switch (role) {
    case 'local_ga':
      return '/map/local';
    case 'central_ga':
      return '/console/tool-consumption';
    case 'sys_admin':
      return '/admin';
    case 'lead':
    case 'pmo':
    default:
      return '/console/dashboard';
  }
}

export function sidebarItemsForRole(role: UserRoleCode): SidebarItem[] {
  switch (role) {
    case 'lead':
    case 'pmo':
      return [
        { path: '/console/dashboard', label: '综合看板' },
        { path: '/console/visits', label: '拜访清单' },
        { path: '/console/pins', label: '图钉清单' },
        { path: '/console/weekly', label: '周观测' },
        { path: '/console/export', label: '导出中心' },
        { path: '/console/tool-consumption', label: '消费排行' },
      ];
    case 'local_ga':
      return [
        { path: '/console/visits', label: '我的拜访' },
        { path: '/console/my-consumption', label: '我的消费' },
      ];
    case 'central_ga':
      return [
        { path: '/central/tools', label: '工具管理' },
        { path: '/central/themes', label: '政策主题' },
        { path: '/console/tool-consumption', label: '消费排行' },
      ];
    case 'sys_admin':
      return [
        { path: '/admin', label: '管理首页' },
        { path: '/admin/users', label: '用户管理' },
        { path: '/admin/roles', label: '角色分配' },
        { path: '/admin/params', label: '系统参数' },
        { path: '/admin/audit', label: '审计日志' },
        { path: '/admin/tickets', label: '工单处理' },
      ];
    default:
      return [];
  }
}
