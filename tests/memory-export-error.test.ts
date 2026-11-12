import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiError} from '../src/api/errors.ts';
import {memoryExportErrorKey} from '../src/hooks/memoryExportError.ts';

test('memory export errors select safe messages without exposing server details', () => {
  const cases: [unknown, string][] = [
    [new ApiError(403, 'feature_unavailable', 'private'), 'memoryPermissionDenied'],
    [new ApiError(401, 'authentication_required', 'private'), 'memorySessionExpired'],
    [new ApiError(409, 'memory_busy', 'private'), 'memoryBusy'],
    [new ApiError(422, 'memory_export_failed', 'private'), 'memoryExportPreparationFailed'],
    [new ApiError(503, 'memory_unavailable', 'private'), 'memoryServerUnavailable'],
    [new TypeError('network failed'), 'memoryServerUnavailable'],
    [new ApiError(400, 'unknown', 'private'), 'memoryExportFailed'],
  ];
  for (const [error, expected] of cases) assert.equal(memoryExportErrorKey(error), expected);
});
