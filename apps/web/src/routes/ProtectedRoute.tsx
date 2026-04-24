import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const location = useLocation();
  const authed = useAuthStore((s) => s.isAuthenticated());

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
