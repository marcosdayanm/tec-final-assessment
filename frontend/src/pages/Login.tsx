import { useState } from "react";
import type { User } from "../types";
import "./Login.css";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface Props {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Correo o contraseña incorrectos.");
        return;
      }

      const data = await res.json();
      onLogin({ email, token: data.token as string });
    } catch {
      // For development without a backend, allow any login
      if (import.meta.env.DEV) {
        onLogin({ email, token: "dev-token" });
      } else {
        setError("No se pudo conectar al servidor.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand__icon">🛡️</span>
          <h1 className="login-brand__name">ITChat</h1>
          <p className="login-brand__sub">Mensajería con detección de amenazas</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email" className="form-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="usuario@tec.mx"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password" className="form-label">Contraseña</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="login-hint">
          En modo desarrollo puedes usar cualquier correo y contraseña.
        </p>
      </div>
    </div>
  );
}
