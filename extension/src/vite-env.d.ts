/// <reference types="vite/client" />

// CSS ?raw imports
declare module '*.css?raw' {
  const content: string
  export default content
}

// Injected by vite.config.ts `define`
declare const __BACKEND_URL__: string
