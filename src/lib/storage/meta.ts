import type { AppMeta, Result } from '@/lib/types';
import { STORAGE_KEYS } from '@/lib/types';
import { safeRead, safeWrite } from '@/lib/storage/core';

const KEY = STORAGE_KEYS.meta;

const DEFAULT_META: AppMeta = {
  lastCheckInAt: null,
  reportUnlockedMonth: null,
  schemaVersion: 1,
};

export function getMeta(): AppMeta {
  return safeRead<AppMeta>(KEY, DEFAULT_META);
}

export function patchMeta(patch: Partial<AppMeta>): Result<AppMeta> {
  const next: AppMeta = { ...getMeta(), ...patch };

  const writeResult = safeWrite(KEY, next);
  if (!writeResult.ok) return { ok: false, error: writeResult.error };

  return { ok: true, data: next };
}
