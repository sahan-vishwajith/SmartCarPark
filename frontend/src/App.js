import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BookingPage from "./pages/BookingPage";

// Admin
import AdminAuthGuard from "./admin/AdminAuthGuard";
import AdminLayout from "./admin/AdminLayout";
import AdminLoginPage from "./admin/pages/AdminLoginPage";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminBookingsPage from "./admin/pages/AdminBookingsPage";
import AdminSlotsPage from "./admin/pages/AdminSlotsPage";
import AdminPaymentsPage from "./admin/pages/AdminPaymentsPage";

export default function App() {
  return (
    <Routes>
      {/* Admin routes (separate, no driver Navbar/PrebookProvider) */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminAuthGuard>
            <AdminLayout />
          </AdminAuthGuard>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="slots" element={<AdminSlotsPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
      </Route>

      {/* Driver / public app */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />

        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Tracking/Booking page */}
        <Route path="booking/:bookingId" element={<BookingPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
