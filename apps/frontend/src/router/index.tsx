import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Navigate, useParams } from 'react-router-dom';
import App from '../App';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import SystemManagementPage from '../pages/SystemManagementPage';
import CapabilityRoute from '../features/auth/components/CapabilityRoute';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import { can, homeRouteFor } from '../features/auth/capabilities';
import { useAuth } from '../features/auth/context/AuthContext';
import RegulationsPage from '../pages/RegulationsPage';
import RiskManagementPage from '../pages/RiskManagementPage';
import SafetyCheckAreasPage from '../pages/SafetyCheckAreasPage';
import SafetyCheckHistoryPage from '../pages/SafetyCheckHistoryPage';
import SafetyCheckDetailPage from '../pages/SafetyCheckDetailPage';
import SafetyCheckTemplatePage from '../pages/SafetyCheckTemplatePage';
import ReportListPage from '../features/reports/pages/ReportListPage';
import ReportDetailPage from '../features/reports/pages/ReportDetailPage';
import DrawingListPage from '../features/drawings/pages/DrawingListPage';
import CreateDrawingPage from '../features/drawings/pages/CreateDrawingPage';
import SimulationSetupPage from '../features/simulations/pages/SimulationSetupPage';
import SimulationListPage from '../features/simulations/pages/SimulationListPage';

const LayoutPage = lazy(() => import('../features/layout/pages/LayoutPage'));
const MyZonesPage = lazy(() => import('../features/zones/pages/MyZonesPage'));
const EvacuationPage = lazy(() => import('../features/zones/pages/EvacuationPage'));
const EvacuationRoutesPage = lazy(() => import('../features/zones/pages/EvacuationRoutesPage'));
const SimulationAnalysisResultPage = lazy(
  () => import('../features/simulationResult/pages/SimulationResultPage'),
);
const LayoutSearchPage = lazy(() => import('../features/layoutSearch/pages/LayoutSearchPage'));
const InspectionMobilePage = lazy(() => import('../pages/InspectionMobilePage'));

function FullscreenRouteFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background text-sm text-text-muted">
      화면을 준비하고 있습니다.
    </div>
  );
}

/** 업무 대시보드를 볼 수 없는 사용자는 홈 대신 담당 구역 화면을 본다. */
function HomeOrMyZones() {
  const { user } = useAuth();
  return can(user?.roles, 'simulations') ? (
    <HomePage />
  ) : (
    <Navigate to={homeRouteFor(user?.roles)} replace />
  );
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
                element: <HomeOrMyZones />,
              },
              {
                element: <CapabilityRoute capability="risks" />,
                children: [{ path: 'risk-management', element: <RiskManagementPage /> }],
              },
              {
                element: <CapabilityRoute capability="reports" />,
                children: [
                  { path: 'reports', element: <ReportListPage /> },
                  { path: 'reports/:reportId', element: <ReportDetailPage /> },
                ],
              },
              {
                element: <CapabilityRoute capability="checklists" />,
                children: [
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
                ],
              },
              {
                element: <CapabilityRoute capability="drawings.view" />,
                children: [
                  { path: 'drawings', element: <DrawingListPage /> },
                  { path: 'drawings/:drawingId', element: <DrawingEditRedirect /> },
                ],
              },
              {
                element: <CapabilityRoute capability="drawings.manage" />,
                children: [{ path: 'drawings/new', element: <CreateDrawingPage /> }],
              },
              {
                element: <CapabilityRoute capability="simulations" />,
                children: [{ path: 'simulations', element: <SimulationListPage /> }],
              },
              {
                element: <CapabilityRoute capability="regulations" />,
                children: [{ path: 'regulations', element: <RegulationsPage /> }],
              },
              {
                element: <CapabilityRoute capability="zones.assigned" />,
                children: [
                  {
                    path: 'my-zones',
                    element: (
                      <Suspense fallback={<FullscreenRouteFallback />}>
                        <MyZonesPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'my-zones/:zoneId/evacuation',
                    element: (
                      <Suspense fallback={<FullscreenRouteFallback />}>
                        <EvacuationPage />
                      </Suspense>
                    ),
                  },
                ],
              },
              {
                element: <CapabilityRoute capability="zones.evacuation.all" />,
                children: [
                  {
                    path: 'drawings/:drawingId/evacuation-routes',
                    element: (
                      <Suspense fallback={<FullscreenRouteFallback />}>
                        <EvacuationRoutesPage />
                      </Suspense>
                    ),
                  },
                ],
              },
              {
                element: <CapabilityRoute capability="systemManagement" />,
                children: [{ path: 'system-management', element: <SystemManagementPage /> }],
              },
            ],
          },
          {
            element: <CapabilityRoute capability="drawings.view" />,
            children: [
              {
                path: 'layout/:drawingId',
                element: (
                  <Suspense fallback={<FullscreenRouteFallback />}>
                    <LayoutPage />
                  </Suspense>
                ),
              },
            ],
          },
          {
            element: <CapabilityRoute capability="simulations" />,
            children: [
              { path: 'simulations/:simulationId/setup', element: <SimulationSetupPage /> },
              {
                path: 'simulations/:simulationId/results',
                element: (
                  <Suspense fallback={<FullscreenRouteFallback />}>
                    <SimulationAnalysisResultPage />
                  </Suspense>
                ),
              },
              {
                path: 'simulations/:simulationId/layout-search',
                element: (
                  <Suspense fallback={<FullscreenRouteFallback />}>
                    <LayoutSearchPage />
                  </Suspense>
                ),
              },
            ],
          },
          {
            element: <CapabilityRoute capability="checklists" />,
            children: [
              {
                path: 'inspect/:areaId',
                element: (
                  <Suspense fallback={<FullscreenRouteFallback />}>
                    <InspectionMobilePage />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
