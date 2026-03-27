/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional base URL for OSRM (no trailing slash), e.g. https://router.project-osrm.org */
  readonly VITE_OSRM_BASE?: string;
}
