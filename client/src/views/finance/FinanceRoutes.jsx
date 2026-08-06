import { Outlet } from 'react-router-dom';
import { FinanceFilterProvider } from '../../context/FinanceFilterContext';

/** Wraps all /finance/* routes so filter context is available to page + layout. */
export default function FinanceRoutes() {
  return (
    <FinanceFilterProvider>
      <Outlet />
    </FinanceFilterProvider>
  );
}
