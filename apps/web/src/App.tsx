import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/pages/Login';
import { Dashboard as LegacyDashboard } from '@/pages/Dashboard';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { LocalMap } from '@/pages/local/LocalMap';
import { PolicyMap } from '@/pages/policy/PolicyMap';
import { ConsoleDashboard } from '@/pages/console/ConsoleDashboard';
import { ToolConsumption } from '@/pages/console/ToolConsumption';
import { AdminHome } from '@/pages/admin/AdminHome';
import { StubPage } from '@/pages/StubPage';
import { defaultRouteForRole } from '@/routes/role-default-route';
import { useAuthStore } from '@/stores/auth';

function RoleRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteForRole(user.roleCode)} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />
        <Route path="map/local" element={<LocalMap />} />
        <Route path="map/policy" element={<PolicyMap />} />
        <Route path="console/dashboard" element={<ConsoleDashboard />} />
        <Route path="console/tool-consumption" element={<ToolConsumption />} />
        <Route
          path="console/visits"
          element={<StubPage title="拜访清单" prdRef="PRD §4.3.4 · B14" />}
        />
        <Route
          path="console/pins"
          element={<StubPage title="图钉清单" prdRef="PRD §4.3 · B7" />}
        />
        <Route
          path="console/weekly"
          element={<StubPage title="周观测" prdRef="PRD §4 · E3" />}
        />
        <Route
          path="console/export"
          element={<StubPage title="导出中心" prdRef="PRD §4 · I 模块" />}
        />
        <Route
          path="console/my-consumption"
          element={<StubPage title="我的消费记录" prdRef="PRD §1.3 · 个人视角" />}
        />
        <Route
          path="central/tools"
          element={<StubPage title="工具管理" prdRef="PRD §4 · D1-D8" />}
        />
        <Route
          path="central/themes"
          element={<StubPage title="政策主题管理" prdRef="PRD §4 · C1-C6" />}
        />
        <Route path="admin" element={<AdminHome />} />
        <Route
          path="admin/users"
          element={<StubPage title="用户管理" prdRef="PRD §4 · H1" />}
        />
        <Route
          path="admin/roles"
          element={<StubPage title="角色分配" prdRef="PRD §4 · H2" />}
        />
        <Route
          path="admin/params"
          element={<StubPage title="系统参数" prdRef="PRD §4 · H3" />}
        />
        <Route
          path="admin/audit"
          element={<StubPage title="审计日志" prdRef="PRD §4 · H5" />}
        />
        <Route
          path="admin/tickets"
          element={<StubPage title="工单处理" prdRef="数据校正 / 归属转移" />}
        />
        <Route path="legacy-dashboard" element={<LegacyDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
