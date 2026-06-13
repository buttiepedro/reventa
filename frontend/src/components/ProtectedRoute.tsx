import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

interface Props {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <p style={{ padding: "2rem" }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
