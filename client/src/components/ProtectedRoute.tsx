import { Navigate } from "react-router-dom";
import authService from "../auth/auth-service";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"student" | "teacher" | "admin">;
  fallbackPath?: string;
}

export default function ProtectedRoute({ children, allowedRoles, fallbackPath = "/" }: ProtectedRouteProps) {
  const isAuthenticated = authService.isAuthenticated();
  const role = authService.getRole();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
