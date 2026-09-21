/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "1", the app uses an in-memory mock backend (the static live demo). */
  readonly VITE_DEMO?: string;
  /** Base URL of the real API (e.g. "https://api.example.com/api"); defaults to "/api". */
  readonly VITE_API_URL?: string;
}
