import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import SystemManagementPage from '../pages/SystemManagementPage';
import AdminRoute from '../features/auth/components/AdminRoute';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import RegulationsPage from '../pages/RegulationsPage';
import RiskManagementPage from '../pages/RiskManagementPage';
import ReportListPage from '../pages/ReportListPage';
import ReportDetailPage from '../pages/ReportDetailPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <WorkspaceLayout />,
            children: [
              {
                index: true,
                element: <HomePage />,
              },
              { path: 'risk-management', element: <RiskManagementPage /> },
              { path: 'reports', element: <ReportListPage /> },
              { path: 'reports/:reportId', element: <ReportDetailPage /> },
              { path: 'regulations', element: <RegulationsPage /> },
              {
                element: <AdminRoute />,
                children: [{ path: 'system-management', element: <SystemManagementPage /> }],
              },
            ],
          },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
