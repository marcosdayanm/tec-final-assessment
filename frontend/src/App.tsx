import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import type { User } from "./types";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
