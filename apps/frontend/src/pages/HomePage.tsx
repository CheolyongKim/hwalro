import { lazy, Suspense } from 'react';

const BuildingExplorer = lazy(() => import('../features/home/components/BuildingExplorer'));

function HomeSceneFallback() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#050b09] text-white/60"
      role="status"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-lime" aria-hidden="true" />
      <p className="text-sm">3D 공간을 준비하고 있습니다.</p>
    </div>
  );
}

function HomePage() {
  return (
    <div className="relative -m-6 h-[100dvh] overflow-hidden bg-[#050b09]">
      <h1 className="sr-only">홈</h1>
      <Suspense fallback={<HomeSceneFallback />}>
        <BuildingExplorer />
      </Suspense>
    </div>
  );
}

export default HomePage;
