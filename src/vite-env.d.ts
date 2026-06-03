/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_ACCOUNT_URL: string | undefined;
  readonly VITE_AZURE_CONTAINER: string | undefined;
  readonly VITE_AZURE_SAS: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.mp3' {
  const src: string;
  export default src;
}
