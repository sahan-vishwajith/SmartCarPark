import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAdminAuth, getStoredAdmin } from "./adminApi";
import "./admin.css";

export default function AdminLayout() {
  const navigate = useNavigate();
  const admin = getStoredAdmin();

  const logout = () => {
    clearAdminAuth();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="adminShell">
      <aside className="adminSidebar">
        <div className="adminBrand">
          <span className="adminBrandAccent">Smart</span>
          <span>Parking</span>
          <small className="adminBrandTag">ADMIN</small>
        </div>

        <nav className="adminNav">
          <NavLink end to="/admin" className="adminNavLink">
            Dashboard
          </NavLink>
          <NavLink to="/admin/bookings" className="adminNavLink">
            Bookings
          </NavLink>
          <NavLink to="/admin/slots" className="adminNavLink">
            Slots
          </NavLink>
          <NavLink to="/admin/payments" className="adminNavLink">
            Payments
          </NavLink>
        </nav>

        <div className="adminSidebarFooter">
          <div className="adminUser">
            <div className="adminUserName">{admin?.fullName || admin?.username || "Admin"}</div>
            <div className="adminUserRole">{admin?.role || "super"}</div>
          </div>
          <button className="adminBtnGhost" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="adminMain">
        <Outlet />
      </main>
    </div>
  );
}
