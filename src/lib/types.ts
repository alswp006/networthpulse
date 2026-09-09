/**
 * 도메인 타입 · 상수 · RouteState — 런타임 코드 없는 순수 선언 파일.
 * import/함수/클래스 선언 금지. 다른 파일은 이 파일에서 타입을 import하고 재정의하지 말 것.
 *
 * location.state 수신 규약:
 * 각 라우트 컴포넌트는 `useLocation().state`를 `RouteState['<path>']`로 캐스팅해 사용한다.
 * state는 항상 `| null`을 포함하므로(직접 URL 접근, 새로고침, 뒤로가기로 state가 없는 진입이
 * 항상 가능하다), 사용 전 null 체크 후 화면별 기본값으로 대체해야 한다 — state가 없다고
 * 에러를 던지거나 빈 화면을 보여주면 안 된다.
 */

// ── 자산 카테고리 ──────────────────────────────────────────────

export type AssetCategory = 'deposit' | 'stock' | 'realestate' | 'loan';

/** 자산 카테고리 목록 — 화면의 Chip/필터 순서 기준 (contract.ts: ASSET_CATEGORIESFn) */
export const ASSET_CATEGORIES: readonly AssetCategory[] = ['deposit', 'stock', 'realestate', 'loan'] as const;

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  deposit: '예금',
  stock: '주식',
  realestate: '부동산',
  loan: '대출',
};

/** 부채로 취급되는 카테고리 */
export const LIABILITY_CATEGORIES: AssetCategory[] = ['loan'];

export const AMOUNT_MIN = 1; // 원
export const AMOUNT_MAX = 999_999_999_999; // 999,999,999,999원 (1조 미만)
export const ASSET_MAX_COUNT = 200;
export const SNAPSHOT_MAX_COUNT = 60; // 최근 60개월

// ── 데이터 모델 ────────────────────────────────────────────────

export interface Asset {
  id: string; // crypto.randomUUID()
  name: string; // 1~20자, trim 후 공백 불가
  category: AssetCategory;
  amount: number; // 정수, 1 ~ 999_999_999_999 (loan도 양수로 저장)
  memo: string; // 0~50자, 미입력 시 ''
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

/** createAsset/updateAsset 입력 — Asset에서 서버(스토리지) 생성 필드를 제외한 형태 */
export type AssetInput = Pick<Asset, 'name' | 'category' | 'amount' | 'memo'>;

export interface NetWorthSnapshot {
  month: string; // 'YYYY-MM' (PK, 유니크)
  totalAssets: number; // deposit+stock+realestate 합
  totalLiabilities: number; // loan 합
  netWorth: number; // totalAssets - totalLiabilities
  byCategory: Record<AssetCategory, number>;
  capturedAt: string; // ISO8601 (마지막 갱신 시각)
}

export interface Goal {
  targetAmount: number; // 정수, 1 ~ 999_999_999_999
  targetDate: string; // 'YYYY-MM-DD', 오늘 이후
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

export type MilestoneId =
  | 'M_FIRST_RECORD'
  | 'M_10M'
  | 'M_50M'
  | 'M_100M'
  | 'M_300M'
  | 'M_500M'
  | 'M_1B'
  | 'M_DEBT_FREE';

export interface Badge {
  id: MilestoneId;
  achievedAt: string; // ISO8601
  netWorthAt: number; // 달성 시점 순자산
}

export interface AppMeta {
  lastCheckInAt: string | null; // ISO8601, 마지막 자산 갱신/체크인 시각
  reportUnlockedMonth: string | null; // 'YYYY-MM', 리워드 광고로 리포트를 연 달
  schemaVersion: 1;
}

/** 파생 계산 결과 — 저장하지 않음 */
export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byCategory: Record<AssetCategory, number>;
  categoryRatio: Record<AssetCategory, number>; // 0~100, 소수 1자리 반올림, 총자산 기준
  debtRatio: number; // totalLiabilities / totalAssets * 100, 총자산 0이면 0
  momDelta: number | null; // 전월 스냅샷 대비 증감액, 전월 없으면 null
}

/** 스토리지 레이어 함수 통일 반환 타입 — error는 사용자에게 그대로 노출되는 한국어 문구 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// ── 마일스톤 정의 ──────────────────────────────────────────────

export interface Milestone {
  id: MilestoneId;
  threshold: number | null; // netWorth 임계값(원). M_DEBT_FREE는 순자산이 아닌 별도 조건 → null
  label: string;
}

/** threshold 오름차순 (null인 M_DEBT_FREE는 별도 조건이라 마지막) */
export const MILESTONES: readonly Milestone[] = [
  { id: 'M_FIRST_RECORD', threshold: 1, label: '첫 기록' },
  { id: 'M_10M', threshold: 10_000_000, label: '1천만원' },
  { id: 'M_50M', threshold: 50_000_000, label: '5천만원' },
  { id: 'M_100M', threshold: 100_000_000, label: '1억원' },
  { id: 'M_300M', threshold: 300_000_000, label: '3억원' },
  { id: 'M_500M', threshold: 500_000_000, label: '5억원' },
  { id: 'M_1B', threshold: 1_000_000_000, label: '10억원' },
  { id: 'M_DEBT_FREE', threshold: null, label: '무부채' },
] as const;

/** 순자산 기준 마일스톤 임계값 목록 (M_DEBT_FREE 제외, 오름차순) — contract.ts: BADGE_MILESTONESFn */
export const BADGE_MILESTONES: readonly number[] = [
  1, 10_000_000, 50_000_000, 100_000_000, 300_000_000, 500_000_000, 1_000_000_000,
] as const;

// ── 자산배분 진단 룰 ────────────────────────────────────────────

export const DIAGNOSIS_RULE_IDS = [
  'R_DEBT_HIGH',
  'R_DEBT_OK',
  'R_RE_HEAVY',
  'R_CASH_LOW',
  'R_STOCK_HEAVY',
  'R_BALANCED',
] as const;

export type DiagnosisRuleId = (typeof DIAGNOSIS_RULE_IDS)[number];

// ── 스토리지 키 ────────────────────────────────────────────────

export const STORAGE_KEYS = {
  assets: 'nwp:assets:v1',
  snapshots: 'nwp:snapshots:v1',
  goal: 'nwp:goal:v1',
  badges: 'nwp:badges:v1',
  meta: 'nwp:meta:v1',
} as const;

// ── 에러 문구 사전 (고정 문자열, 테스트에서 정확 일치 검증) ─────────

export const ERROR_MESSAGES = [
  '저장 공간이 부족해요. 오래된 항목을 삭제해주세요',
  '자산은 최대 200개까지 등록할 수 있어요',
  '이름과 금액을 확인해주세요',
  '금액을 1원 이상 입력해주세요',
  '금액은 999,999,999,999원까지 입력할 수 있어요',
  '이름은 20자까지 입력할 수 있어요',
  '목표 금액을 1원 이상 입력해주세요',
  '목표 금액은 999,999,999,999원까지 입력할 수 있어요',
  '목표 날짜는 오늘 이후로 정해주세요',
  '항목을 찾을 수 없어요',
  '광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요',
  '데이터를 불러오지 못했어요',
] as const;

// ── 라우트별 location.state 계약 ────────────────────────────────

export interface RouteState {
  '/': null;
  '/assets': { filterCategory: AssetCategory } | null;
  '/assets/new': { presetCategory: AssetCategory } | null;
  '/assets/:id/edit': { presetCategory: AssetCategory } | null;
  '/trend': { initialRange: 3 | 6 | 12 } | null;
  '/goal': { openEditor: boolean } | null;
  '/badges': { highlightBadgeId: MilestoneId } | null;
  '/report': null;
}
