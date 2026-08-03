import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-black text-ink">Hwalro</h1>
      {user && (
        <p className="text-sm text-ink/70">
          {user.name} ({user.loginId}) 님, 환영합니다. 권한: {user.role}
        </p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-2xl bg-ink px-6 py-3 text-sm font-bold text-white transition hover:bg-ink/85"
      >
        로그아웃
      </button>
    </div>
  );
}

export default HomePage;
