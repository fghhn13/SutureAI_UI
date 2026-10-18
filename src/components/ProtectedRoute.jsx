import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { homePathFor } from "../auth/demoAccounts.js";
import { useI18n } from "../i18n/index.js";

/**
 * Requires sign-in; with `roles`, also requires one of those roles (others are sent to
 * their own home page).
 * @param {{ roles?: string[] }} props
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  if (loading) {
    return <p className="py-24 text-center text-sm text-grey-500">{t("common.loading")}</p>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}
