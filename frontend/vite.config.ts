import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "")
  const voiceApiProxyTarget =
    env.VITE_VOICE_API_PROXY_TARGET || "http://127.0.0.1:8000"
  const liveblocksAuthProxyTarget =
    env.VITE_LIVEBLOCKS_AUTH_PROXY_TARGET || "http://127.0.0.1:8787"

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/auth/liveblocks": {
          target: liveblocksAuthProxyTarget,
          changeOrigin: true,
        },
        "/api": {
          target: voiceApiProxyTarget,
          changeOrigin: true,
        },
        "/auth": {
          target: voiceApiProxyTarget,
          changeOrigin: true,
        },
        "/boards": {
          target: voiceApiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
