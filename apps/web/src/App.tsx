import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/pages/Login';
import { AppShell } from '@/layouts/AppShell';
import { MapShell } from '@/pages/MapShell';
import { Console } from '@/pages/Console';
import { Admin } from '@/pages/Admin';
import { Me } from '@/pages/Me';
import { DashboardTab } from '@/pages/console/DashboardTab';
import { VisitsTab } from '@/pages/console/VisitsTab';
import { OrgsTab } from '@/pages/console/OrgsTab';
import { ContactsTab } from '@/pages/console/ContactsTab';
import { ToolsTab } from '@/pages/console/ToolsTab';
import { ThemesTab } from '@/pages/console/ThemesTab';
import { WeeklyTab } from '@/pages/console/WeeklyTab';
import { ConsumptionTab } from '@/pages/console/ConsumptionTab';
import { PinsTab } from '@/pages/console/PinsTab';
import { ExportTab } from '@/pages/console/ExportTab';
import { MyConsumptionTab } from '@/pages/console/MyConsumptionTab';
import { UsersPage } from '@/pages/admin/UsersPage';
import { RolesPage } from '@/pages/admin/RolesPage';
import { ParamsPage } from '@/pages/admin/ParamsPage';
import { AuditPage } from '@/pages/admin/AuditPage';
import { TicketsPage } from '@/pages/admin/TicketsPage';
import { ExportPage } from '@/pages/admin/ExportPage';
import { MobileVisitNewPage } from '@/pages/mobile/MobileVisitNewPage';
import { MobileDonePage } from '@/pages/mobile/MobileDonePage';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { useAuthStore } from '@/stores/auth';
import { homeForRole } from '@/lib/role-home';
import { CONSOLE_DEFAULT_BY_ROLE } from '@/lib/console-tabs';

/** Mobile 路由 wrapper — 仅 Outlet,无 chrome,适合手机直接渲染表单 */
function MobileShell() {
  return <Outlet />;
}

/** 登录后 / 进入 `/` 时按 §6.2 角色派发 */
function RoleHomeRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeForRole(user.roleCode)} replace />;
}

/** /console 不带子路径时按角色派发到默认 tab */
function ConsoleDefaultRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={CONSOLE_DEFAULT_BY_ROLE[user.roleCode]} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* R2-⑤ 移动端独立路由 — 不挂 AppShell(没顶栏 sidebar) */}
      <Route
        path="/m"
        element={
          <ProtectedRoute>
            <MobileShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/m/visit/new" replace />} />
        <Route path="visit/new" element={<MobileVisitNewPage />} />
        <Route path="done" element={<MobileDonePage />} />
      </Route>

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHomeRedirect />} />

        {/* R2-① 大盘视图(双子共用画布) */}
        <Route path="map/local" element={<MapShell />} />
        <Route path="map/policy" element={<MapShell />} />

        {/* R2-② 工作台 */}
        <Route path="console" element={<Console />}>
          <Route index element={<ConsoleDefaultRedirect />} />
          <Route path="dashboard" element={<DashboardTab />} />
          <Route path="visits" element={<VisitsTab />} />
          <Route path="orgs" element={<OrgsTab />} />
          <Route path="contacts" element={<ContactsTab />} />
          <Route path="tools" element={<ToolsTab />} />
          <Route path="themes" element={<ThemesTab />} />
          <Route path="weekly" element={<WeeklyTab />} />
          <Route path="consumption" element={<ConsumptionTab />} />
          <Route path="pins" element={<PinsTab />} />
          <Route path="export" element={<ExportTab />} />
          <Route path="my-consumption" element={<MyConsumptionTab />} />
        </Route>

        {/* R2-③ 管理后台(sys_admin only) */}
        <Route path="admin" element={<Admin />}>
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="params" element={<ParamsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>

        {/* R2-④ 个人中心 */}
        <Route path="me" element={<Me />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
