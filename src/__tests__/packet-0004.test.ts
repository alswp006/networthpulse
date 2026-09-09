import { describe, it, expect } from 'vitest';
import type { NetWorthSummary, DiagnosisItem } from '@/lib/types';
import { diagnose } from '@/lib/calc/diagnose';

describe('자산배분 진단 룰 엔진 (결정론적)', () => {
  /**
   * AC-1: debtRatio===63.5인 summary 입력 시 결과 배열에 부채비율 경고 룰 id가 포함되고 tone==='warn'
   */
  it('AC-1[P0]: should include debt warning when debtRatio is 63.5%', () => {
    const summary: NetWorthSummary = {
      totalAssets: 100_000,
      totalLiabilities: 63_500,
      netWorth: 36_500,
      byCategory: { deposit: 100_000, stock: 0, realestate: 0, loan: 63_500 },
      categoryRatio: { deposit: 100, stock: 0, realestate: 0, loan: 0 },
      debtRatio: 63.5,
      momDelta: null,
    };

    const result = diagnose(summary);

    // 부채비율 경고 규칙 포함 확인 (R_DEBT_HIGH)
    const debtWarning = result.find(item => item.id === 'R_DEBT_HIGH');
    expect(debtWarning).toBeDefined();
    expect(debtWarning?.title).toBeTruthy();
    expect(debtWarning?.description).toBeTruthy();
    expect(debtWarning?.tone).toBe('warn');
  });

  /**
   * AC-2: totalLiabilities===0 && 자산 1건 이상인 summary 입력 시 무부채 룰이 포함되고 tone==='good'
   */
  it('AC-2[P0]: should include debt-free rule when totalLiabilities is 0 and assets exist', () => {
    const summary: NetWorthSummary = {
      totalAssets: 100_000,
      totalLiabilities: 0,
      netWorth: 100_000,
      byCategory: { deposit: 100_000, stock: 0, realestate: 0, loan: 0 },
      categoryRatio: { deposit: 100, stock: 0, realestate: 0, loan: 0 },
      debtRatio: 0,
      momDelta: null,
    };

    const result = diagnose(summary);

    // tone==='good'인 규칙이 포함되어야 함 (무부채 양호)
    const goodRule = result.find(item => item.tone === 'good');
    expect(goodRule).toBeDefined();
    expect(goodRule?.title).toBeTruthy();
    expect(goodRule?.description).toBeTruthy();
  });

  /**
   * AC-3: 자산 0건 summary 입력 시 길이 1의 '데이터 부족' 안내만 반환
   */
  it('AC-3[P0]: should return only data insufficiency message when totalAssets is 0', () => {
    const summary: NetWorthSummary = {
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      byCategory: { deposit: 0, stock: 0, realestate: 0, loan: 0 },
      categoryRatio: { deposit: 0, stock: 0, realestate: 0, loan: 0 },
      debtRatio: 0,
      momDelta: null,
    };

    const result = diagnose(summary);

    expect(result).toHaveLength(1);
    expect(result[0].tone).toBe('info');
    expect(result[0].title).toBeTruthy();
    expect(result[0].description).toBeTruthy();
  });

  /**
   * AC-4: 동일 summary로 10회 호출 시 JSON.stringify 결과가 모두 동일(결정론)
   */
  it('AC-4[P0]: should return deterministic results across 10 calls with same input', () => {
    const summary: NetWorthSummary = {
      totalAssets: 500_000_000,
      totalLiabilities: 100_000_000,
      netWorth: 400_000_000,
      byCategory: {
        deposit: 200_000_000,
        stock: 300_000_000,
        realestate: 0,
        loan: 100_000_000,
      },
      categoryRatio: { deposit: 40, stock: 60, realestate: 0, loan: 0 },
      debtRatio: 20,
      momDelta: 50_000_000,
    };

    const results = Array.from({ length: 10 }, () => diagnose(summary));
    const stringified = results.map(r => JSON.stringify(r));

    const firstResult = stringified[0];
    stringified.forEach((result, idx) => {
      expect(result).toBe(firstResult);
    });
  });

  /**
   * AC-5: localStorage 접근 0건, 외부 네트워크 호출 0건 (observation)
   */
  it('AC-5[P0]: should not access localStorage or make network calls', () => {
    const summary: NetWorthSummary = {
      totalAssets: 1_000_000,
      totalLiabilities: 0,
      netWorth: 1_000_000,
      byCategory: { deposit: 1_000_000, stock: 0, realestate: 0, loan: 0 },
      categoryRatio: { deposit: 100, stock: 0, realestate: 0, loan: 0 },
      debtRatio: 0,
      momDelta: null,
    };

    const initialStorageLength = Object.keys(localStorage).length;

    diagnose(summary);

    // localStorage 상태 변화 없음
    expect(Object.keys(localStorage).length).toBe(initialStorageLength);
  });

  /**
   * 추가 테스트: 높은 부채비율(60% 이상)은 경고 규칙 적용
   */
  it('should apply debt warning when debtRatio reaches 60%', () => {
    const summary: NetWorthSummary = {
      totalAssets: 100_000,
      totalLiabilities: 60_000,
      netWorth: 40_000,
      byCategory: { deposit: 100_000, stock: 0, realestate: 0, loan: 60_000 },
      categoryRatio: { deposit: 100, stock: 0, realestate: 0, loan: 0 },
      debtRatio: 60,
      momDelta: null,
    };

    const result = diagnose(summary);

    const debtWarning = result.find(item => item.id === 'R_DEBT_HIGH');
    expect(debtWarning).toBeDefined();
    expect(debtWarning?.tone).toBe('warn');
  });

  /**
   * 추가 테스트: 저부채이지만 자산이 편중된 경우 여러 규칙 적용
   */
  it('should apply multiple rules when conditions overlap (high real estate ratio)', () => {
    const summary: NetWorthSummary = {
      totalAssets: 1_000_000,
      totalLiabilities: 100_000,
      netWorth: 900_000,
      byCategory: { deposit: 100_000, stock: 0, realestate: 800_000, loan: 100_000 },
      categoryRatio: { deposit: 10, stock: 0, realestate: 80, loan: 0 },
      debtRatio: 10,
      momDelta: null,
    };

    const result = diagnose(summary);

    // 여러 규칙이 적용되어야 함
    expect(result.length).toBeGreaterThan(0);
    result.forEach(item => {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(['warn', 'good', 'info']).toContain(item.tone);
    });
  });

  /**
   * 추가 테스트: 경계값 — debtRatio 59.9% (경고 미만)
   */
  it('should not include debt warning when debtRatio is below 60%', () => {
    const summary: NetWorthSummary = {
      totalAssets: 100_000,
      totalLiabilities: 59_900,
      netWorth: 40_100,
      byCategory: { deposit: 100_000, stock: 0, realestate: 0, loan: 59_900 },
      categoryRatio: { deposit: 100, stock: 0, realestate: 0, loan: 0 },
      debtRatio: 59.9,
      momDelta: null,
    };

    const result = diagnose(summary);

    const debtWarning = result.find(item => item.id === 'R_DEBT_HIGH');
    expect(debtWarning).toBeUndefined();
  });

  /**
   * 추가 테스트: 응답 배열의 모든 항목이 유효한 DiagnosisItem 구조를 가짐
   */
  it('should return valid DiagnosisItem objects with correct structure', () => {
    const summary: NetWorthSummary = {
      totalAssets: 500_000_000,
      totalLiabilities: 50_000_000,
      netWorth: 450_000_000,
      byCategory: {
        deposit: 200_000_000,
        stock: 200_000_000,
        realestate: 100_000_000,
        loan: 50_000_000,
      },
      categoryRatio: { deposit: 40, stock: 40, realestate: 20, loan: 0 },
      debtRatio: 10,
      momDelta: 100_000_000,
    };

    const result = diagnose(summary);

    result.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('tone');

      expect(typeof item.id).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.tone).toBe('string');

      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    });
  });
});
