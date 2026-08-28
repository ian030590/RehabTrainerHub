import { Outlet, useLocation } from 'react-router-dom';

export function TrainerRouteOutlet() {
  const location = useLocation();

  return (
    <div className="trainer-route-transition" key={location.pathname}>
      <Outlet />
    </div>
  );
}
