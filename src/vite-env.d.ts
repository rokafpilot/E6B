/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_FLAVOR?: 'prod' | 'trial' | string;
  readonly VITE_NMS_API_CLIENT_ID?: string;
  readonly VITE_NMS_API_CLIENT_SECRET?: string;
  readonly VITE_NMS_API_ENVIRONMENT?: 'production' | 'staging' | 'fit';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
