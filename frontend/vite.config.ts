import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const backend = loadEnv(mode, "../backend", "PORT");
  return {
    plugins: [react()],
    resolve: {
      alias: { "@src": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/health": `http://127.0.0.1:${process.env.PORT ?? backend.PORT ?? "3001"}`,
        "/v1": {
          target: `http://127.0.0.1:${process.env.PORT ?? backend.PORT ?? "3001"}`,
          changeOrigin: false,
        },
      },
    },
  };
});
