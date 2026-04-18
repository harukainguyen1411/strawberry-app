/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_RELEASE_TIME: string
  readonly VITE_RELEASE_NOTES: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
