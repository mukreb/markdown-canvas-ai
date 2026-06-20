import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Vite serves the React app and proxies /api to the Express server in dev.
// We load .env (no prefix filter) so a developer who sets PORT only in .env —
// as the README documents — gets a proxy target that follows that override.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = env.PORT || "8787";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
