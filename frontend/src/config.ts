// Si VITE_API_URL/VITE_WS_URL están vacías, se usan rutas relativas y el proxy de Vite (desarrollo).
export const frontendConfig = {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "",
  websocketUrl: import.meta.env.VITE_WS_URL ?? "",
};
