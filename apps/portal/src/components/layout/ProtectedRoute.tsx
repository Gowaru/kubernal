import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { FC, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@kubernal/shared-types';

interface ProtectedRouteProps {
  requiredRole?: UserRole;
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        aria-label="Chargement"
        aria-busy="true"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"
          role="status"
          aria-label="Chargement"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

interface RequireRoleProps {
  role: UserRole;
  children?: ReactNode;
}

export const RequireRole: FC<RequireRoleProps> = ({ role, children }) => {
  const { hasRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        aria-label="Chargement"
        aria-busy="true"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"
          role="status"
          aria-label="Chargement"
        />
      </div>
    );
  }

  if (!hasRole(role)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
