import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RiskManagementPage from '../pages/RiskManagementPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <WorkspaceLayout />,
        children: [{ index: true, element: <HomePage /> }],
      },
      { path: 'risk-management', element: <RiskManagementPage /> },
    ],
  },
]);
