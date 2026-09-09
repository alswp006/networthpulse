import type { Badge } from '@/lib/types';
import { MILESTONES, STORAGE_KEYS } from '@/lib/types';
import { nowISO, safeRead, safeWrite } from '@/lib/storage/core';

const KEY = STORAGE_KEYS.badges;

function readAll(): Badge[] {
  return safeRead<Badge[]>(KEY, []);
}

export function listBadges(): Badge[] {
  return readAll();
}

/** netWorth 기준 마일스톤을 평가해 아직 없는 뱃지만 새로 부여한다. 이미 부여된 뱃지는 유지(순자산 하락에도 회수 없음) */
export function evaluateBadges(netWorth: number): Badge[] {
  const existing = readAll();
  const existingIds = new Set(existing.map((badge) => badge.id));
  const now = nowISO();

  const newlyAwarded: Badge[] = [];
  for (const milestone of MILESTONES) {
    if (milestone.threshold === null) continue; // M_DEBT_FREE는 별도 조건 — 여기서 평가하지 않음
    if (existingIds.has(milestone.id)) continue;
    if (netWorth >= milestone.threshold) {
      newlyAwarded.push({ id: milestone.id, achievedAt: now, netWorthAt: netWorth });
    }
  }

  if (newlyAwarded.length === 0) return [];

  safeWrite(KEY, [...existing, ...newlyAwarded]);
  return newlyAwarded;
}
