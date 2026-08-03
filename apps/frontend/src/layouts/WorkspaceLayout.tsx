import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';

function WorkspaceLayout() {
  return (
    <div className="flex min-h-[100dvh] bg-background text-ink">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}

export default WorkspaceLayout;
