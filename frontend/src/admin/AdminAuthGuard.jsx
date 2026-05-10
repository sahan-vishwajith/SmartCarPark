import { Navigate, useLocation } from "react-router-dom";
import { getAdminToken } from "./adminApi";

export default function AdminAuthGuard({ children }) {
  const location = useLocation();
  const token = getAdminToken();
  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return children;
}
