import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import MapHome from './pages/MapHome';
import MainLayout from './layouts/MainLayout';
import WorkbenchLayout from './layouts/WorkbenchLayout';
import ExpansionList from './pages/Workbench/ExpansionList';
import Users from './pages/Workbench/Users';
import Toolkits from './pages/Workbench/Toolkits';
import History from './pages/Workbench/History';
import NotFound from './pages/NotFound';
import { useAuthStore } from './stores/authStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<MapHome />} />
        <Route path="/workbench" element={<WorkbenchLayout />}>
          <Route index element={<Navigate to="expansion" replace />} />
          <Route path="expansion" element={<ExpansionList />} />
          <Route path="users" element={<Users />} />
          <Route path="toolkits" element={<Toolkits />} />
          <Route path="history" element={<History />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
