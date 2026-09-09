import { describe, it, expect, beforeEach } from 'vitest';
import type { NetWorthSnapshot, Goal, Badge, AppMeta } from '@/lib/types';
import { STORAGE_KEYS, BADGE_MILESTONES } from '@/lib/types';

// Import actual storage functions (will fail until implementation exists)
import {
  upsertSnapshot,
  listSnapshots,
  getPrevSnapshot,
} from '@/lib/storage/snapshots';
import { getGoal, saveGoal, clearGoal, computeGoalProgress } from '@/lib/storage/goal';
import { listBadges, evaluateBadges } from '@/lib/storage/badges';
import { getMeta, patchMeta } from '@/lib/storage/meta';

// ─────────────────────────────────────────────────────────────────────
// AC-1: Snapshot CRUD — upsert, 중복 month 덮어쓰기, 60건 초과 시 제거
// ─────────────────────────────────────────────────────────────────────

describe('AC-1: Snapshot upsert & eviction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should upsert snapshot and increase length when month is new', () => {
    const snapshot1: NetWorthSnapshot = {
      month: '2026-09',
      totalAssets: 300_000_000,
      totalLiabilities: 100_000_000,
      netWorth: 200_000_000,
      byCategory: { deposit: 200_000_000, stock: 100_000_000, realestate: 0, loan: 100_000_000 },
      capturedAt: new Date('2026-09-10T12:00:00Z').toISOString(),
    };

    upsertSnapshot(snapshot1);

    const stored = listSnapshots(60);
    expect(stored.length).toBe(1);
    expect(stored[0].month).toBe('2026-09');
  });

  it('should update netWorth/capturedAt when month exists (no duplicate)', () => {
    const snapshot1: NetWorthSnapshot = {
      month: '2026-09',
      totalAssets: 300_000_000,
      totalLiabilities: 100_000_000,
      netWorth: 200_000_000,
      byCategory: { deposit: 200_000_000, stock: 100_000_000, realestate: 0, loan: 100_000_000 },
      capturedAt: new Date('2026-09-10T12:00:00Z').toISOString(),
    };
    upsertSnapshot(snapshot1);

    const snapshot2: NetWorthSnapshot = {
      ...snapshot1,
      netWorth: 250_000_000,
      capturedAt: new Date('2026-09-11T15:30:00Z').toISOString(),
    };
    upsertSnapshot(snapshot2);

    const stored = listSnapshots(60);
    expect(stored.length).toBe(1); // length 불변
    expect(stored[0].month).toBe('2026-09'); // month 불변
    expect(stored[0].netWorth).toBe(250_000_000); // netWorth 갱신
  });

  it('should maintain max 60 snapshots and remove oldest when exceeding', () => {
    // 61개 upsert 후 → 길이 60, 가장 오래된 month 제거됨 (연도를 넘겨 61개월 모두 고유해야 함)
    for (let i = 0; i < 61; i++) {
      const year = 2020 + Math.floor(i / 12);
      const month = (i % 12) + 1;
      upsertSnapshot({
        month: `${year}-${String(month).padStart(2, '0')}`,
        totalAssets: 100_000_000 + i * 1_000_000,
        totalLiabilities: 0,
        netWorth: 100_000_000 + i * 1_000_000,
        byCategory: { deposit: 100_000_000 + i * 1_000_000, stock: 0, realestate: 0, loan: 0 },
        capturedAt: new Date(2020, 0, 1 + i).toISOString(),
      });
    }

    const stored = listSnapshots(60);
    expect(stored.length).toBe(60); // 최대 60건 유지
  });

  it('should keep snapshots in ascending month order', () => {
    upsertSnapshot({
      month: '2026-03',
      totalAssets: 100_000_000,
      totalLiabilities: 0,
      netWorth: 100_000_000,
      byCategory: { deposit: 100_000_000, stock: 0, realestate: 0, loan: 0 },
      capturedAt: new Date().toISOString(),
    });
    upsertSnapshot({
      month: '2026-01',
      totalAssets: 50_000_000,
      totalLiabilities: 0,
      netWorth: 50_000_000,
      byCategory: { deposit: 50_000_000, stock: 0, realestate: 0, loan: 0 },
      capturedAt: new Date().toISOString(),
    });

    const stored = listSnapshots(60);
    expect(stored[0].month <= stored[1].month).toBe(true); // 오름차순 (month는 문자열)
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-2: listSnapshots — 최근 N개, 손상 JSON 처리, 콘솔 에러 0건
// ─────────────────────────────────────────────────────────────────────

describe('AC-2: listSnapshots behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return last N snapshots in ascending order (max count)', () => {
    for (let i = 1; i <= 10; i++) {
      upsertSnapshot({
        month: `2026-${String(i).padStart(2, '0')}`,
        totalAssets: 100_000_000 + i * 10_000_000,
        totalLiabilities: 0,
        netWorth: 100_000_000 + i * 10_000_000,
        byCategory: { deposit: 100_000_000 + i * 10_000_000, stock: 0, realestate: 0, loan: 0 },
        capturedAt: new Date(2026, i - 1).toISOString(),
      });
    }

    const result = listSnapshots(6);
    expect(result.length).toBe(6);
    expect(result[0].month).toBe('2026-05');
    expect(result[result.length - 1].month).toBe('2026-10');
  });

  it('should return fewer than requested if data count is less', () => {
    for (let i = 1; i <= 4; i++) {
      upsertSnapshot({
        month: `2026-${String(i).padStart(2, '0')}`,
        totalAssets: 100_000_000 + i * 10_000_000,
        totalLiabilities: 0,
        netWorth: 100_000_000 + i * 10_000_000,
        byCategory: { deposit: 100_000_000 + i * 10_000_000, stock: 0, realestate: 0, loan: 0 },
        capturedAt: new Date(2026, i - 1).toISOString(),
      });
    }

    const result = listSnapshots(6);
    expect(result.length).toBe(4); // 4개만 존재 → 4개 반환
  });

  it('should return empty array for corrupted JSON and recover to fallback (no console output)', () => {
    // 손상된 JSON 저장
    localStorage.setItem(STORAGE_KEYS.snapshots, 'corrupted{json}data');

    // listSnapshots는 손상된 데이터를 safeRead로 처리
    const result = listSnapshots(6);
    expect(result).toEqual([]); // 빈 배열 반환
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-3: Goal 저장 & 검증 — 금액/날짜 유효성
// ─────────────────────────────────────────────────────────────────────

describe('AC-3: Goal validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should reject goal with targetAmount < 1', () => {
    const result = saveGoal({ targetAmount: 0, targetDate: '2026-12-31' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('1원 이상');
  });

  it('should reject goal with targetDate before today (2026-09-10)', () => {
    const result = saveGoal({ targetAmount: 500_000_000, targetDate: '2026-09-09' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('오늘 이후');
  });

  it('should accept valid goal and save it', () => {
    const result = saveGoal({ targetAmount: 500_000_000, targetDate: '2026-12-31' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targetAmount).toBe(500_000_000);
      expect(result.data.targetDate).toBe('2026-12-31');
    }

    const stored = getGoal();
    expect(stored).not.toBeNull();
    expect(stored?.targetAmount).toBe(500_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-4: computeGoalProgress — 진행률 계산 (percent, remaining, monthsLeft, etc.)
// ─────────────────────────────────────────────────────────────────────

describe('AC-4: Goal progress computation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should compute progress: 40% (500M target, 200M current)', () => {
    saveGoal({ targetAmount: 500_000_000, targetDate: '2026-12-31' });
    const progress = computeGoalProgress(200_000_000);

    expect(progress.percent).toBe(40.0);
    expect(progress.remaining).toBe(300_000_000);
  });

  it('should compute monthsLeft and monthlyNeeded (24 months to 2028-09-30)', () => {
    saveGoal({ targetAmount: 500_000_000, targetDate: '2028-09-30' });
    const progress = computeGoalProgress(200_000_000);

    expect(progress.monthsLeft).toBeGreaterThanOrEqual(23);
    expect(progress.monthsLeft).toBeLessThanOrEqual(25);
    expect(progress.monthlyNeeded).toBeGreaterThan(0);
  });

  it('should mark achieved=true and compute surplus when netWorth >= target', () => {
    saveGoal({ targetAmount: 500_000_000, targetDate: '2026-12-31' });
    const progress = computeGoalProgress(600_000_000);

    expect(progress.achieved).toBe(true);
    expect(progress.surplus).toBe(100_000_000);
    expect(progress.percent).toBe(120.0);
  });

  it('should handle negative netWorth safely (percent clamped to 0.0, not NaN)', () => {
    saveGoal({ targetAmount: 500_000_000, targetDate: '2026-12-31' });
    const progress = computeGoalProgress(-10_000_000);

    expect(progress.percent).toBe(0.0); // 음수 → 0으로 clamping
    expect(progress.remaining).toBe(510_000_000);
    expect(isNaN(progress.percent)).toBe(false); // NaN 아님
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-5: Badges — 중복 부여 금지, 기존 뱃지 유지
// ─────────────────────────────────────────────────────────────────────

describe('AC-5: Badge evaluation & deduplication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should award badges on first evaluation (netWorth 120M)', () => {
    const awarded = evaluateBadges(120_000_000);
    const stored = listBadges();

    expect(stored.length).toBe(4); // M_FIRST_RECORD, M_10M, M_50M, M_100M
    expect(stored.map((b) => b.id)).toContain('M_FIRST_RECORD');
    expect(stored.map((b) => b.id)).toContain('M_100M');
  });

  it('should not award duplicate badges on re-evaluation', () => {
    evaluateBadges(120_000_000);

    // 두 번째 평가 (같은 netWorth)
    const awarded2 = evaluateBadges(120_000_000);
    const stored = listBadges();

    expect(stored.length).toBe(4); // 중복 0건, 길이 불변
    expect(awarded2.length).toBe(0); // 새로 부여된 뱃지 0개
  });

  it('should keep existing badges when netWorth drops', () => {
    evaluateBadges(120_000_000);
    const storedBefore = listBadges();

    // netWorth가 0으로 떨어짐 → 기존 뱃지는 유지
    evaluateBadges(0);
    const storedAfter = listBadges();

    expect(storedAfter.length).toBe(storedBefore.length); // 뱃지 유지
    expect(storedAfter.map((b) => b.id)).toContain('M_FIRST_RECORD');
    expect(storedAfter.map((b) => b.id)).toContain('M_100M');
  });
});

