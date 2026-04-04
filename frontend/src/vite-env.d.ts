/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVEBLOCKS_PUBLIC_KEY?: string
  readonly VITE_VOICE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
