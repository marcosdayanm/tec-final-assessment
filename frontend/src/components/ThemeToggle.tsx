import { useTheme } from "../hooks/useTheme";
import { MoonIcon, SunIcon } from "./icons";
import "./ThemeToggle.css";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={`theme-toggle ${isLight ? "theme-toggle--light" : ""}`}
      role="switch"
      aria-checked={isLight}
      aria-label="Cambiar tema claro/oscuro"
      title={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
        <MoonIcon size={13} />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
        <SunIcon size={13} />
      </span>
      <span className="theme-toggle__knob" aria-hidden="true" />
    </button>
  );
}
