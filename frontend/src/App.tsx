import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import type { SessionUser } from "./types";
import "./App.css";

const SESSION_STORAGE_KEY = "itchat-session";

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // Al cargar, restaura la sesión guardada en localStorage para sobrevivir recargas.
    const serializedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!serializedSession) {
      return;
    }

    try {
      const parsedSession = JSON.parse(serializedSession) as SessionUser;
      setUser(parsedSession);
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const handleSessionChange = (nextUser: SessionUser | null) => {
    setUser(nextUser);
    if (nextUser === null) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
  };

  if (!user) {
    return <Login onLogin={handleSessionChange} />;
  }

  return <Dashboard user={user} onLogout={() => handleSessionChange(null)} />;
}
