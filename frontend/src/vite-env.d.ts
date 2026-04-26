/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Express API origin, e.g. http://127.0.0.1:3001 (no trailing slash). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
