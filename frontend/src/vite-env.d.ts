/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_LIVEBLOCKS_PUBLIC_KEY?: string
  readonly VITE_VOICE_API_BASE_URL?: string
  readonly VITE_VOICE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
