import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../auth";

export default function RegisterPage() {
  const vehicleTypes = useMemo(
    () => ["Car", "Van", "Bike", "Three-Wheeler", "Truck"],
    []
  );

  const [form, setForm] = useState({
    username: "",
    password: "",
    driverName: "",
    vehicleNumber: "",
    vehicleType: vehicleTypes[0],
    phoneNumber: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const navigate = useNavigate();

  function onChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const payload = {
        username: form.username,
        password: form.password,
        driverName: form.driverName,
        vehicleNumber: form.vehicleNumber,
        vehicleType: form.vehicleType,
        phoneNumber: form.phoneNumber,
      };

      await registerUser(payload);

      setInfo("Registration successful! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 900);
    } catch (err) {
      console.error("Register error", err);
      if (err?.body?.error) setError(err.body.error);
      else setError("Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authWrap">
      <section className="authCard">
        <div className="authHeader">
          <h2 className="authTitle">Create your account</h2>
          <p className="authSub">Register to manage your parking.</p>
        </div>

        <form className="authForm" onSubmit={onSubmit} autoComplete="off">
          <label className="field">
            <span className="fieldLabel">Username</span>
            <input
              className="fieldInput"
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder="Choose a unique username"
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

          <label className="field">
            <span className="fieldLabel">Driver Name</span>
            <input
              className="fieldInput"
              name="driverName"
              value={form.driverName}
              onChange={onChange}
              placeholder="e.g., Janmi Fernando"
              required
            />
          </label>

          <label className="field">
            <span className="fieldLabel">Vehicle Number</span>
            <input
              className="fieldInput"
              name="vehicleNumber"
              value={form.vehicleNumber}
              onChange={onChange}
              placeholder="e.g., CAA-1234"
              required
            />
          </label>

          <label className="field">
            <span className="fieldLabel">Vehicle Type</span>
            <select
              className="fieldInput fieldSelect"
              name="vehicleType"
              value={form.vehicleType}
              onChange={onChange}
              required
            >
              {vehicleTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="fieldLabel">Phone Number</span>
            <input
              className="fieldInput"
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={onChange}
              placeholder="e.g., 07X XXX XXXX"
              inputMode="tel"
              required
            />
          </label>

          {error && <p className="authError">{error}</p>}
          {info && <p className="authInfo">{info}</p>}

          <button className="primaryBtn authBtn" type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>

          <p className="authFooterText">
            Already registered?{" "}
            <Link className="authLink" to="/login">
              Login
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}