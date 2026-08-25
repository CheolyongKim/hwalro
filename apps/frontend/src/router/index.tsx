import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Navigate, useParams } from 'react-router-dom';
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
import DrawingListPage from '../features/drawings/pages/DrawingListPage';
import SimulationSetupPage from '../features/simulations/pages/SimulationSetupPage';
import SimulationListPage from '../features/simulations/pages/SimulationListPage';
import { CanvasWorkspaceState } from '../components/workspace';
import {
  DRAWING_WORKSPACE_LOADING_MESSAGE,
  SIMULATION_RESULT_LOADING_MESSAGE,
} from '../components/workspace/workspaceLoadingMessages';

const LayoutPage = lazy(() => import('../features/layout/pages/LayoutPage'));
const CreateDrawingPage = lazy(() => import('../features/drawings/pages/CreateDrawingPage'));
const SimulationAnalysisResultPage = lazy(
  () => import('../features/simulationResult/pages/SimulationResultPage'),
);
const LayoutSearchPage = lazy(() => import('../features/layoutSearch/pages/LayoutSearchPage'));
const InspectionMobilePage = lazy(() => import('../pages/InspectionMobilePage'));

function FullscreenRouteFallback({ message }: { message: string }) {
  return <CanvasWorkspaceState message={message} role="status" />;
}

function DrawingEditRedirect() {
  const { drawingId } = useParams();
  return <Navigate to={`/layout/${drawingId}`} replace />;
}

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
              { path: 'drawings', element: <DrawingListPage /> },
              { path: 'simulations', element: <SimulationListPage /> },
              { path: 'drawings/:drawingId', element: <DrawingEditRedirect /> },
              { path: 'regulations', element: <RegulationsPage /> },
              {
                element: <AdminRoute />,
                children: [{ path: 'system-management', element: <SystemManagementPage /> }],
              },
            ],
          },
          {
            path: 'drawings/new',
            element: (
              <Suspense fallback={<div className="h-[100dvh] w-full bg-background" />}>
                <CreateDrawingPage />
              </Suspense>
            ),
          },
          {
            path: 'layout/:drawingId',
            element: (
              <Suspense
                fallback={<FullscreenRouteFallback message={DRAWING_WORKSPACE_LOADING_MESSAGE} />}
              >
                <LayoutPage />
              </Suspense>
            ),
          },
          { path: 'simulations/:simulationId/setup', element: <SimulationSetupPage /> },
          {
            path: 'simulations/:simulationId/results',
            element: (
              <Suspense
                fallback={<FullscreenRouteFallback message={SIMULATION_RESULT_LOADING_MESSAGE} />}
              >
                <SimulationAnalysisResultPage />
              </Suspense>
            ),
          },
          {
            path: 'simulations/:simulationId/layout-search',
            element: (
              <Suspense fallback={<FullscreenRouteFallback message="배치 개선안을 준비하고 있습니다." />}>
                <LayoutSearchPage />
              </Suspense>
            ),
          },
          {
            path: 'inspect/:areaId',
            element: (
              <Suspense fallback={<FullscreenRouteFallback message="점검 화면을 준비하고 있습니다." />}>
                <InspectionMobilePage />
              </Suspense>
            ),
          },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
