import { Outlet } from 'react-router-dom';
import DefaultLayout from '@/layouts/default';

export default function IndexPage() {
  return (
    <DefaultLayout>
      <Outlet />
    </DefaultLayout>
  );
}
