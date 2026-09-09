import type { Asset, NetWorthSnapshot, NetWorthSummary, DiagnosisItem } from '@/lib/types';
import { computeSummary } from '@/lib/calc/summary';

/**
 * 자산배분 진단 룰 엔진 — 결정론적 진단 (AI 미사용, 동일 입력 → 동일 출력)
 * 조건은 .ai-factory/spec.md F6 "진단 룰 테이블" 순서를 그대로 따른다.
 * @param summary NetWorthSummary 입력
 * @returns DiagnosisItem[] 진단 결과 배열
 */
export function diagnose(summary: NetWorthSummary): DiagnosisItem[] {
  if (summary.totalAssets <= 0) {
    return [
      {
        id: 'R_BALANCED',
        title: '아직 진단할 자산이 없어요',
        description: '자산을 1개 이상 등록하면 자산배분 진단을 볼 수 있어요',
        tone: 'info',
      },
    ];
  }

  const { debtRatio, categoryRatio } = summary;
  const items: DiagnosisItem[] = [];

  if (debtRatio >= 60) {
    items.push({
      id: 'R_DEBT_HIGH',
      title: '부채비율이 높아요',
      description: '총자산 대비 부채가 60% 이상이에요. 부채 상환을 우선 검토해보세요',
      tone: 'warn',
    });
  }

  if (debtRatio < 30) {
    items.push({
      id: 'R_DEBT_OK',
      title: '부채비율이 안정적이에요',
      description: '부채비율이 30% 미만으로 안정적이에요',
      tone: 'good',
    });
  }

  if (categoryRatio.realestate >= 70) {
    items.push({
      id: 'R_RE_HEAVY',
      title: '부동산 비중이 높아요',
      description: '부동산 비중이 70% 이상이에요. 현금화가 어려울 수 있어요',
      tone: 'warn',
    });
  }

  if (categoryRatio.deposit < 10) {
    items.push({
      id: 'R_CASH_LOW',
      title: '현금성 자산이 부족해요',
      description: '현금성 자산이 10% 미만이에요. 비상금 확보를 검토해보세요',
      tone: 'warn',
    });
  }

  if (categoryRatio.stock >= 60) {
    items.push({
      id: 'R_STOCK_HEAVY',
      title: '주식 비중이 높아요',
      description: '주식 비중이 60% 이상이에요. 변동성이 클 수 있어요',
      tone: 'warn',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'R_BALANCED',
      title: '자산배분이 균형 잡혀 있어요',
      description: '자산배분이 특정 항목에 치우치지 않았어요',
      tone: 'info',
    });
  }

  return items;
}

/** 진단 룰 ID → 관련 카테고리·비중 스코어 매핑 (diagnoseAllocation 전용) */
const RULE_CATEGORY: Record<DiagnosisItem['id'], string> = {
  R_DEBT_HIGH: 'loan',
  R_DEBT_OK: 'loan',
  R_RE_HEAVY: 'realestate',
  R_CASH_LOW: 'deposit',
  R_STOCK_HEAVY: 'stock',
  R_BALANCED: 'balanced',
};

function ruleScore(id: DiagnosisItem['id'], summary: NetWorthSummary): number {
  switch (id) {
    case 'R_DEBT_HIGH':
    case 'R_DEBT_OK':
      return summary.debtRatio;
    case 'R_RE_HEAVY':
      return summary.categoryRatio.realestate;
    case 'R_CASH_LOW':
      return summary.categoryRatio.deposit;
    case 'R_STOCK_HEAVY':
      return summary.categoryRatio.stock;
    default:
      return 0;
  }
}

/**
 * 자산배분 진단 — contract.ts diagnoseAllocationFn 계약.
 * assets(+선택적 이전 스냅샷)로 NetWorthSummary를 계산해 diagnose() 룰 엔진에 넘기고,
 * 결과를 {category, score, advice} 형태로 얇게 변환한다 (다른 패킷은 이 이름으로 import한다).
 */
export function diagnoseAllocation(
  assets: Asset[],
  snapshot?: NetWorthSnapshot
): { category: string; score: number; advice: string }[] {
  const summary = computeSummary(assets, snapshot);
  return diagnose(summary).map((item) => ({
    category: RULE_CATEGORY[item.id],
    score: ruleScore(item.id, summary),
    advice: item.description,
  }));
}
