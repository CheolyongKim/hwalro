import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { element: <ProtectedRoute />, children: [{ index: true, element: <HomePage /> }] },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
