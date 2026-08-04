import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AdminRoute() {
  const { user } = useAuth();

  if (!user?.roles.includes('관리자')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
