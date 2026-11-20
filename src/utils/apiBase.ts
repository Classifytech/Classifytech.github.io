/**
 * Resolves the backend API base URL.
 * - When running natively on Blogger (*.blogspot.com), routes /api/* calls to the deployed Cloud Run server.
 * - On Cloud Run (classifytech.ai.studio / *.run.app) and localhost, returns '' for relative /api/* paths.
 */
export const CLOUD_RUN_API_ORIGIN = 'https://classifytech.ai.studio';

export function resolveApiBase(hostname?: string): string {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (host === 'blogspot.com' || host.endsWith('.blogspot.com')) {
    return CLOUD_RUN_API_ORIGIN;
  }
  return '';
}

export const API_BASE: string = resolveApiBase();
