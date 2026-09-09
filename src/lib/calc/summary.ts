import type { Asset, AssetCategory, NetWorthSnapshot, NetWorthSummary } from "@/lib/types";
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from "@/lib/types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeSummary(
  assets: Asset[],
  prev?: NetWorthSnapshot
): NetWorthSummary {
  const byCategory = ASSET_CATEGORIES.reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<AssetCategory, number>);

  for (const asset of assets) {
    byCategory[asset.category] += asset.amount;
  }

  const totalLiabilities = LIABILITY_CATEGORIES.reduce(
    (sum, category) => sum + byCategory[category],
    0
  );
  const totalAssets = ASSET_CATEGORIES.filter(
    (category) => !LIABILITY_CATEGORIES.includes(category)
  ).reduce((sum, category) => sum + byCategory[category], 0);

  const netWorth = totalAssets - totalLiabilities;

  const categoryRatio = ASSET_CATEGORIES.reduce((acc, category) => {
    acc[category] =
      LIABILITY_CATEGORIES.includes(category) || totalAssets === 0
        ? 0
        : round1((byCategory[category] / totalAssets) * 100);
    return acc;
  }, {} as Record<AssetCategory, number>);

  const debtRatio =
    totalAssets === 0 ? 0 : round1((totalLiabilities / totalAssets) * 100);

  const momDelta = prev ? netWorth - prev.netWorth : null;

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    byCategory,
    categoryRatio,
    debtRatio,
    momDelta,
  };
}

/**
 * 순자산 계산 — contract.ts calculateNetWorthFn 계약.
 * computeSummary의 얇은 서브셋 래퍼 (다른 패킷은 이 이름으로 import한다).
 */
export function calculateNetWorth(
  assets: Asset[]
): { totalAssets: number; totalLiabilities: number; netWorth: number } {
  const { totalAssets, totalLiabilities, netWorth } = computeSummary(assets);
  return { totalAssets, totalLiabilities, netWorth };
}
