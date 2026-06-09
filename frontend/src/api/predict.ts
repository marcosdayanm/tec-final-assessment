import type { MessageLabel, PredictResponse } from "../types";

// Change this to your backend URL
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function predictMessage(
  text: string,
  token: string
): Promise<MessageLabel> {
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) return "real";

    const data: PredictResponse = await res.json();
    return data.label;
  } catch {
    // If backend is unreachable, fail silently
    return "real";
  }
}
