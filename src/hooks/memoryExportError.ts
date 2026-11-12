import {ApiError} from '../api/errors.ts';

// Map only known codes/statuses; never display the server's exception message.
export function memoryExportErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'memoryServerUnavailable';
  if (error.code === 'feature_unavailable' || error.status === 403) return 'memoryPermissionDenied';
  if (error.code === 'authentication_required' || error.status === 401) return 'memorySessionExpired';
  if (error.code === 'memory_busy') return 'memoryBusy';
  if (error.code === 'memory_export_failed') return 'memoryExportPreparationFailed';
  if (error.code.startsWith('memory_export_')) return 'memoryExportPreparationFailed';
  if (error.code === 'personal_memory_not_found') return 'memoryNotFound';
  if (error.status >= 500) return 'memoryServerUnavailable';
  return 'memoryExportFailed';
}
