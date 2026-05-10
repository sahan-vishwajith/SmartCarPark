import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { adminAuthApi, setAdminAuth } from "../adminApi";
import "../admin.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    try {
      setLoading(true);
      const data = await adminAuthApi.login(username.trim(), password);
      setAdminAuth(data.token, data.admin);
      const redirect = location.state?.from?.pathname || "/admin";
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adminLoginShell">
      <form className="adminLoginCard" onSubmit={onSubmit}>
        <h1 className="adminLoginTitle">Admin Sign-in</h1>
        <p className="adminLoginSub">SmartParking control panel</p>

        {error && <div className="adminError">{error}</div>}

        <div className="adminLoginField">
          <label>Username</label>
          <input
            className="adminInput"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="adminLoginField">
          <label>Password</label>
          <input
            className="adminInput"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="adminBtn" disabled={loading} style={{ width: "100%", marginTop: 6 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="smallText" style={{ marginTop: 14 }}>
          Need an admin account? Run{" "}
          <code style={{ color: "#fbbf24" }}>python -m scripts.create_admin --username … --password …</code>{" "}
          on the backend.
        </p>
      </form>
    </div>
  );
}
