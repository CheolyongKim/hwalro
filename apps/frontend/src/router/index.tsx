import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import RegulationsPage from '../pages/RegulationsPage';
import RiskManagementPage from '../pages/RiskManagementPage';
import WorkspaceLayout from '../layouts/WorkspaceLayout';

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
            children: [{ index: true, element: <HomePage /> }],
          },
          {
            path: 'risk-management',
            element: <WorkspaceLayout />,
            children: [{ index: true, element: <RiskManagementPage /> }],
          },
          { path: 'regulations', element: <RegulationsPage /> },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
