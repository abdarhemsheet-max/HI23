/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_B2_KEY_ID: string;
  readonly VITE_B2_APPLICATION_KEY: string;
  readonly VITE_B2_BUCKET_ID: string;
  readonly VITE_B2_BUCKET_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
