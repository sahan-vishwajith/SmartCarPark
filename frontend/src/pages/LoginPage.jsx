import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { login } from "../auth";

export default function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  function onChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form.username, form.password);

      // IMPORTANT: update navbar in same tab immediately
      window.dispatchEvent(new Event("auth-changed"));

      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login error", err);
      if (err?.body?.error) setError(err.body.error);
      else setError("Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authWrap">
      <section className="authCard">
        <div className="authHeader">
          <h2 className="authTitle">Welcome back</h2>
          <p className="authSub">Login to continue.</p>
        </div>

        <form className="authForm" onSubmit={onSubmit} autoComplete="off">
          <label className="field">
            <span className="fieldLabel">Username</span>
            <input
              className="fieldInput"
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder="e.g., CAA-1234"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>

          <label className="field">
            <span className="fieldLabel">Password</span>
            <input
              className="fieldInput"
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p className="authError">{error}</p>}

          <button className="primaryBtn authBtn" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="authFooterText">
          Don&apos;t have an account?{" "}
          <Link className="authLink" to="/register">
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}