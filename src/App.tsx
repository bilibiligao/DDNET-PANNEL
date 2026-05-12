import { Suspense, lazy, useEffect } from 'react';
import { Provider } from 'react-redux';
import { Route, Routes, useNavigate } from 'react-router-dom';
import PageLoading from '@/components/page_loading';
import Toaster from '@/components/toaster';
import DialogProvider from '@/contexts/dialog';
import store from '@/store';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

const WebLoginPage = lazy(() => import('@/pages/web_login'));
const IndexPage = lazy(() => import('@/pages/index'));

const DashboardIndexPage = lazy(() => import('@/pages/dashboard/index'));
const MapsPage = lazy(() => import('@/pages/dashboard/maps'));
const StorePage = lazy(() => import('@/pages/dashboard/store'));
const ConsolePage = lazy(() => import('@/pages/dashboard/console'));
const LogPage = lazy(() => import('@/pages/dashboard/log'));

function AuthChecker({ children }: { children: React.ReactNode }) {
  const authenticated = useSelector((s: RootState) => s.auth?.authenticated ?? !!localStorage.getItem('ddnet_token'));
  const navigate = useNavigate();
  useEffect(() => {
    if (!authenticated) navigate('/web_login', { replace: true });
  }, [authenticated, navigate]);
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<AuthChecker><IndexPage /></AuthChecker>}>
        <Route index element={<DashboardIndexPage />} />
        <Route path='maps' element={<MapsPage />} />
        <Route path='store' element={<StorePage />} />
        <Route path='console' element={<ConsolePage />} />
        <Route path='log' element={<LogPage />} />
      </Route>
      <Route path='/web_login' element={<WebLoginPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <DialogProvider>
      <Provider store={store}>
        <Toaster />
        <Suspense fallback={<PageLoading />}>
          <AppRoutes />
        </Suspense>
      </Provider>
    </DialogProvider>
  );
}
