import type { NetWorthSnapshot, Result } from '@/lib/types';
import { SNAPSHOT_MAX_COUNT, STORAGE_KEYS } from '@/lib/types';
import { safeRead, safeWrite } from '@/lib/storage/core';

const KEY = STORAGE_KEYS.snapshots;

function readAll(): NetWorthSnapshot[] {
  return safeRead<NetWorthSnapshot[]>(KEY, []);
}

function sortByMonth(snapshots: NetWorthSnapshot[]): NetWorthSnapshot[] {
  return [...snapshots].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

/** month(PK)가 이미 있으면 해당 항목을 덮어쓰고, 없으면 추가한다. 오름차순 정렬 유지, 최대 60건 초과 시 가장 오래된 month 제거 */
export function upsertSnapshot(snapshot: NetWorthSnapshot): Result<NetWorthSnapshot> {
  const snapshots = readAll();
  const index = snapshots.findIndex((s) => s.month === snapshot.month);

  let next: NetWorthSnapshot[];
  if (index === -1) {
    next = sortByMonth([...snapshots, snapshot]);
    if (next.length > SNAPSHOT_MAX_COUNT) {
      next = next.slice(next.length - SNAPSHOT_MAX_COUNT);
    }
  } else {
    next = sortByMonth(snapshots.map((s, i) => (i === index ? snapshot : s)));
  }

  const writeResult = safeWrite(KEY, next);
  if (!writeResult.ok) return { ok: false, error: writeResult.error };

  return { ok: true, data: snapshot };
}

/** 최근 count개(이하)를 month 오름차순으로 반환 */
export function listSnapshots(count: number): NetWorthSnapshot[] {
  const sorted = sortByMonth(readAll());
  if (count >= sorted.length) return sorted;
  return sorted.slice(sorted.length - count);
}

/** 주어진 month보다 이전인 스냅샷 중 가장 최근 것 */
export function getPrevSnapshot(month: string): NetWorthSnapshot | null {
  const prior = sortByMonth(readAll()).filter((s) => s.month < month);
  return prior.length > 0 ? prior[prior.length - 1] : null;
}
