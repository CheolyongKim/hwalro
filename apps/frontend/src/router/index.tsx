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
import SafetyCheckAreasPage from '../pages/SafetyCheckAreasPage';
import SafetyCheckHistoryPage from '../pages/SafetyCheckHistoryPage';
import SafetyCheckDetailPage from '../pages/SafetyCheckDetailPage';
import SafetyCheckTemplatePage from '../pages/SafetyCheckTemplatePage';
import ReportListPage from '../features/reports/pages/ReportListPage';
import ReportDetailPage from '../features/reports/pages/ReportDetailPage';
import LayoutPage from '../features/layout/pages/LayoutPage';

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
              { path: 'safety-checklists', element: <SafetyCheckAreasPage /> },
              {
                path: 'safety-checklists/areas/:areaId',
                element: <SafetyCheckHistoryPage />,
              },
              {
                path: 'safety-checklists/inspections/:inspectionId',
                element: <SafetyCheckDetailPage />,
              },
              {
                path: 'safety-checklists/areas/:areaId/template',
                element: <SafetyCheckTemplatePage />,
              },
              { path: 'reports/:reportId', element: <ReportDetailPage /> },
              { path: 'regulations', element: <RegulationsPage /> },
              {
                element: <AdminRoute />,
                children: [{ path: 'system-management', element: <SystemManagementPage /> }],
              },
            ],
          },
          { path: 'layout/:drawingId', element: <LayoutPage /> },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
