import { useState } from "react";
import { login, register } from "../api/chat";
import type { SessionUser } from "../types";
import "./Login.css";

interface Props {
  onLogin: (user: SessionUser) => void;
}

export function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = { username, password };
      const authResponse = mode === "login" ? await login(payload) : await register(payload);
      onLogin({ ...authResponse.user, token: authResponse.token });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar al servidor."
      );
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

        <div className="login-mode-switch">
          <button
            className={`login-mode-switch__btn ${mode === "login" ? "login-mode-switch__btn--active" : ""}`}
            type="button"
            onClick={() => setMode("login")}
          >
            Iniciar sesión
          </button>
          <button
            className={`login-mode-switch__btn ${mode === "register" ? "login-mode-switch__btn--active" : ""}`}
            type="button"
            onClick={() => setMode("register")}
          >
            Crear cuenta
          </button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="username" className="form-label">Usuario</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="usuario_tec"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
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
            {loading ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <p className="login-hint">
          Usa el mismo usuario y contraseña que registraste en el backend.
        </p>
      </div>
    </div>
  );
}
