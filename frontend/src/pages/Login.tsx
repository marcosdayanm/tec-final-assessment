import { useState } from "react";
import { login, register } from "../api/chat";
import { EyeIcon, EyeOffIcon } from "../components/icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { useTheme } from "../hooks/useTheme";
import type { SessionUser } from "../types";
import "./Login.css";

interface Props {
  onLogin: (user: SessionUser) => void;
}

function getPasswordStrength(password: string): {
  level: number;
  label: string;
} {
  if (!password) {
    return { level: 0, label: "" };
  }
  let checks = 0;
  if (password.length >= 8) checks += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) checks += 1;
  if (/\d/.test(password)) checks += 1;
  if (/[^A-Za-z0-9]/.test(password)) checks += 1;
  const level = Math.max(1, checks);
  const labels = ["", "Débil", "Media", "Buena", "Fuerte"];
  return { level, label: labels[level] };
}

export function Login({ onLogin }: Props) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleModeChange = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError("");
    setEmail("");
    setFullName("");
    setBio("");
    setAvatarUrl("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const authResponse =
        mode === "login"
          ? await login({ username, password })
          : await register({
              username,
              password,
              email,
              full_name: fullName,
              bio: bio || undefined,
              avatar_url: avatarUrl || undefined,
            });
      onLogin({ ...authResponse.user, token: authResponse.token });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar al servidor.",
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="login-page">
      <div className="login-page__theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <img
            className="login-brand__icon"
            src={theme === "dark" ? "/Logo_Dark.png" : "/Logo_Light.png"}
            alt="ITChat"
          />
        </div>

        <div className="login-mode-switch">
          <button
            className={`login-mode-switch__btn ${mode === "login" ? "login-mode-switch__btn--active" : ""}`}
            type="button"
            onClick={() => handleModeChange("login")}
          >
            Iniciar sesión
          </button>
          <button
            className={`login-mode-switch__btn ${mode === "register" ? "login-mode-switch__btn--active" : ""}`}
            type="button"
            onClick={() => handleModeChange("register")}
          >
            Crear cuenta
          </button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="username" className="form-label">
              Usuario
            </label>
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

          {mode === "register" && (
            <>
              <div className="form-field">
                <label htmlFor="email" className="form-label">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="alguien@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-field">
                <label htmlFor="fullName" className="form-label">
                  Nombre completo
                </label>
                <input
                  id="fullName"
                  type="text"
                  className="form-input"
                  placeholder="Ada Lovelace"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </>
          )}

          <div className="form-field">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="password-input">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input password-input__field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                className="password-input__toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                title={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {mode === "register" && password && (
              <div
                className={`password-strength password-strength--level-${passwordStrength.level}`}
              >
                <div className="password-strength__bars">
                  <span className="password-strength__bar" />
                  <span className="password-strength__bar" />
                  <span className="password-strength__bar" />
                  <span className="password-strength__bar" />
                </div>
                <span className="password-strength__label">
                  {passwordStrength.label}
                </span>
              </div>
            )}
          </div>

          {mode === "register" && (
            <div className="form-field">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmar contraseña
              </label>
              <div className="password-input">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-input password-input__field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-input__toggle"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  title={
                    showConfirmPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <span className="password-mismatch">
                  Las contraseñas no coinciden.
                </span>
              )}
            </div>
          )}

          {mode === "register" && (
            <>
              <div className="form-field">
                <label htmlFor="bio" className="form-label">
                  Bio (opcional)
                </label>
                <input
                  id="bio"
                  type="text"
                  className="form-input"
                  placeholder="Cuéntanos algo sobre ti"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="avatarUrl" className="form-label">
                  Foto de perfil (URL, opcional)
                </label>
                <input
                  id="avatarUrl"
                  type="url"
                  className="form-input"
                  placeholder="https://ejemplo.com/foto.png"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading
              ? "Procesando…"
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
