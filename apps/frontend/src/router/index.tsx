import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegulationsPage from '../pages/RegulationsPage';
import RiskManagementPage from '../pages/RiskManagementPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'login', element: <LoginPage /> },
      // 공통 사이드바의 '안전 법령' 메뉴가 연결할 독립 화면 경로다.
      { path: 'regulations', element: <RegulationsPage /> },
      {
        element: <WorkspaceLayout />,
        children: [{ index: true, element: <HomePage /> }],
      },
      { path: 'risk-management', element: <RiskManagementPage /> },
    ],
  },
]);
