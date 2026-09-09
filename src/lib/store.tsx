import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Asset,
  AssetInput,
  AppMeta,
  Badge,
  Goal,
  MilestoneId,
  NetWorthSnapshot,
  NetWorthSummary,
  Result,
} from '@/lib/types';
import { SNAPSHOT_MAX_COUNT } from '@/lib/types';
import { currentMonth, nowISO } from '@/lib/storage/core';
import { computeSummary } from '@/lib/calc/summary';
import { createAsset, deleteAsset, listAssets, updateAsset } from '@/lib/storage/assets';
import { getPrevSnapshot, listSnapshots, upsertSnapshot } from '@/lib/storage/snapshots';
import { getGoal, saveGoal } from '@/lib/storage/goal';
import type { GoalInput } from '@/lib/storage/goal';
import { evaluateBadges, listBadges } from '@/lib/storage/badges';
import { getMeta, patchMeta } from '@/lib/storage/meta';

interface AppState {
  loaded: boolean;
  assets: Asset[];
  snapshots: NetWorthSnapshot[];
  goal: Goal | null;
  badges: Badge[];
  meta: AppMeta;
  newBadges: Badge[];
}

export interface AppDataValue {
  loaded: boolean;
  assets: Asset[];
  summary: NetWorthSummary | undefined;
  snapshots: NetWorthSnapshot[];
  goal: Goal | null;
  badges: Badge[];
  meta: AppMeta;
  newBadges: Badge[];
  addAsset: (input: AssetInput) => Result<Asset>;
  editAsset: (id: string, patch: Partial<AssetInput>) => Result<Asset>;
  removeAsset: (id: string) => Result<{ id: string }>;
  setGoal: (input: GoalInput) => Result<Goal>;
  checkIn: () => Result<AppMeta>;
  consumeBadge: (id: MilestoneId) => void;
}

const INITIAL_META: AppMeta = { lastCheckInAt: null, reportUnlockedMonth: null, schemaVersion: 1 };

const initialState: AppState = {
  loaded: false,
  assets: [],
  snapshots: [],
  goal: null,
  badges: [],
  meta: INITIAL_META,
  newBadges: [],
};

/** 자산 변경 후 공통 처리: 현재 달 스냅샷 upsert + 뱃지 평가 → 신규 뱃지는 newBadges 큐에 적재 */
function syncAfterAssetChange(state: AppState, nextAssets: Asset[]): AppState {
  const month = currentMonth();
  const prev = getPrevSnapshot(month) ?? undefined;
  const summary = computeSummary(nextAssets, prev);

  const snapshot: NetWorthSnapshot = {
    month,
    totalAssets: summary.totalAssets,
    totalLiabilities: summary.totalLiabilities,
    netWorth: summary.netWorth,
    byCategory: summary.byCategory,
    capturedAt: nowISO(),
  };
  upsertSnapshot(snapshot);
  const nextSnapshots = listSnapshots(SNAPSHOT_MAX_COUNT);

  const newlyAwarded = evaluateBadges(summary.netWorth);
  const nextBadges = newlyAwarded.length > 0 ? listBadges() : state.badges;
  const nextNewBadges = newlyAwarded.length > 0 ? [...state.newBadges, ...newlyAwarded] : state.newBadges;

  return {
    ...state,
    assets: nextAssets,
    snapshots: nextSnapshots,
    badges: nextBadges,
    newBadges: nextNewBadges,
  };
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    setState({
      loaded: true,
      assets: listAssets(),
      snapshots: listSnapshots(SNAPSHOT_MAX_COUNT),
      goal: getGoal(),
      badges: listBadges(),
      meta: getMeta(),
      newBadges: [],
    });
  }, []);

  const addAsset = useCallback((input: AssetInput): Result<Asset> => {
    const result = createAsset(input);
    if (!result.ok) return result;
    setState((prev) => syncAfterAssetChange(prev, [...prev.assets, result.data]));
    return result;
  }, []);

  const editAsset = useCallback((id: string, patch: Partial<AssetInput>): Result<Asset> => {
    const result = updateAsset(id, patch);
    if (!result.ok) return result;
    setState((prev) =>
      syncAfterAssetChange(
        prev,
        prev.assets.map((asset) => (asset.id === id ? result.data : asset)),
      ),
    );
    return result;
  }, []);

  const removeAsset = useCallback((id: string): Result<{ id: string }> => {
    const result = deleteAsset(id);
    if (!result.ok) return result;
    setState((prev) => syncAfterAssetChange(prev, prev.assets.filter((asset) => asset.id !== id)));
    return result;
  }, []);

  const setGoalAction = useCallback((input: GoalInput): Result<Goal> => {
    const result = saveGoal(input);
    if (result.ok) {
      setState((prev) => ({ ...prev, goal: result.data }));
    }
    return result;
  }, []);

  const checkIn = useCallback((): Result<AppMeta> => {
    const result = patchMeta({ lastCheckInAt: nowISO() });
    if (result.ok) {
      setState((prev) => ({ ...prev, meta: result.data }));
    }
    return result;
  }, []);

  const consumeBadge = useCallback((id: MilestoneId) => {
    setState((prev) => ({ ...prev, newBadges: prev.newBadges.filter((badge) => badge.id !== id) }));
  }, []);

  const summary = useMemo<NetWorthSummary | undefined>(() => {
    if (!state.loaded) return undefined;
    const prev = getPrevSnapshot(currentMonth()) ?? undefined;
    return computeSummary(state.assets, prev);
  }, [state.loaded, state.assets]);

  const value = useMemo<AppDataValue>(
    () => ({
      loaded: state.loaded,
      assets: state.assets,
      summary,
      snapshots: state.snapshots,
      goal: state.goal,
      badges: state.badges,
      meta: state.meta,
      newBadges: state.newBadges,
      addAsset,
      editAsset,
      removeAsset,
      setGoal: setGoalAction,
      checkIn,
      consumeBadge,
    }),
    [state, summary, addAsset, editAsset, removeAsset, setGoalAction, checkIn, consumeBadge],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (ctx === null) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return ctx;
}
