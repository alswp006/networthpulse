# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 도메인 엔티티 — 모든 패킷이 사용 (구현: 패킷 0001) */
export type Asset = { id: string; category: string; amount: number; date: string; memo?: string };

/** 순자산 스냅샷 — 0006, 0007, 0014, 0015에서 사용 (구현: 패킷 0001) */
export type Snapshot = { id: string; date: string; netWorth: number; createdAt: string };

/** 목표 엔티티 — 0006, 0007, 0009, 0018에서 사용 (구현: 패킷 0001) */
export type Goal = { id: string; label: string; targetAmount: number; deadline: string; achieved: boolean };

/** 뱃지 엔티티 — 0006, 0007, 0009, 0019에서 사용 (구현: 패킷 0001) */
export type Badge = { id: string; type: string; unlocked: boolean; unlockedAt?: string; milestone: number };

/** 라우트 상태 — 0020(Router)에서 사용 (구현: 패킷 0001) */
export type RouteState = 'home' | 'assets' | 'trend' | 'report' | 'goal' | 'badges';

/** 자산 카테고리 목록 상수 (구현: 패킷 0001) */
export type ASSET_CATEGORIESFn = readonly string[];

/** 뱃지 마일스톤 배열 상수 (구현: 패킷 0001) */
export type BADGE_MILESTONESFn = readonly number[];

/** 저장소에서 읽기 — 0005, 0006이 호출 (구현: 패킷 0002) */
export type readStorageFn = (key: string) => Promise<any>;

/** 저장소에 쓰기 — 0005, 0006이 호출 (구현: 패킷 0002) */
export type writeStorageFn = (key: string, data: any) => Promise<void>;

/** 저장소에서 삭제 — 0005, 0006이 호출 (구현: 패킷 0002) */
export type deleteStorageFn = (key: string) => Promise<void>;

/** 트랜잭션 래퍼 — 0005, 0006에서 사용 (구현: 패킷 0002) */
export type withStorageTransactionFn = <T>(fn: (err?: Error) => Promise<T> | T) => Promise<{ data?: T; error?: Error }>;

/** 순자산 계산 — 0008, 0010, 0015, 0017에서 사용 (구현: 패킷 0003) */
export type calculateNetWorthFn = (assets: Asset[]) => { totalAssets: number; totalLiabilities: number; netWorth: number };

/** 금액 포맷팅 — 0008, 0010, 0014, 0015, 0017에서 사용 (구현: 패킷 0003) */
export type formatCurrencyFn = (amount: number, opts?: { currency?: string }) => string;

/** 비율 포맷팅 — 0014, 0015, 0017에서 사용 (구현: 패킷 0003) */
export type formatPercentageFn = (rate: number, opts?: { decimals?: number; showSign?: boolean }) => string;

/** 자산배분 진단 — 0017(리포트)에서 사용 (구현: 패킷 0004) */
export type diagnoseAllocationFn = (assets: Asset[], snapshot?: Snapshot) => { category: string; score: number; advice: string }[];

/** 모든 자산 조회 — 0007, 0008, 0010, 0012, 0013에서 사용 (구현: 패킷 0005) */
export type listAssetsFn = () => Promise<Asset[]>;

/** 자산 추가 — 0012(자산 추가 폼)에서 호출 (구현: 패킷 0005) */
export type createAssetFn = (asset: Omit<Asset, 'id'>) => Promise<Asset>;

/** 자산 수정 — 0013(자산 수정)에서 호출 (구현: 패킷 0005) */
export type updateAssetFn = (id: string, updates: Partial<Asset>) => Promise<Asset>;

/** 자산 삭제 — 0011(행 액션)에서 호출 (구현: 패킷 0005) */
export type deleteAssetFn = (id: string) => Promise<void>;

/** 스냅샷 목록 — 0014, 0015에서 사용 (구현: 패킷 0006) */
export type listSnapshotsFn = () => Promise<Snapshot[]>;

/** 현재 자산으로 스냅샷 기록 — 0008(체크인)에서 호출 (구현: 패킷 0006) */
export type recordSnapshotFn = (assets: Asset[]) => Promise<Snapshot>;

/** 현재 목표 조회 — 00
```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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
export type 
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    AssetRowActions.tsx
    BadgeCelebrationSheet.tsx
    BottomCTA.tsx
    Card.tsx
    CheckInBanner.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    GoalMiniCard.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    ToastHost.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    calc/
    contract.ts
    format.ts
    storage/
    storage.ts
    store.tsx
    types.ts
    utils.ts
  main.tsx
  pages/
    AssetEdit.tsx
    AssetNew.tsx
    Assets.tsx
    Badges.tsx
    Goal.tsx
    Home.tsx
    NotFound.tsx
    Report.tsx
    Trend.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
    jest-dom.d.ts
  vite-env.d.ts

### Exports (src/lib/)
- calc/diagnose.ts: export function diagnose(summary: NetWorthSummary): DiagnosisItem[]; export function diagnoseAllocation( assets: Asset[], snapshot?: NetWorthSnapshot ):
- calc/summary.ts: export function computeSummary( assets: Asset[], prev?: NetWorthSnapshot ): NetWorthSummary; export function calculateNetWorth( assets: Asset[] ):
- contract.ts: export type Asset =; export type Snapshot =; export type Goal =; export type Badge =; export type RouteState = 'home' | 'assets' | 'trend' | 'report' | 'goal' | 'badges'; export type ASSET_CATEGORIESFn = readonly string[]; export type BADGE_MILESTONESFn = readonly number[]; export type readStorageFn = (key: string) => Promise<any>
- format.ts: export function formatKRW(amount: number): string; export function formatCompactKRW(amount: number): string; export function formatSignedKRW(amount: number): string; export function formatPercent(value: number): string; export function formatPercentage( rate: number, opts?:
- storage/assets.ts: export function listAssets(): Asset[]; export function getAsset(id: string): Asset | null; export function createAsset(input: AssetInput): Result<Asset>; export function updateAsset(id: string, patch: Partial<AssetInput>): Result<Asset>; export function deleteAsset(id: string): Result<
- storage/badges.ts: export function listBadges(): Badge[]; export function evaluateBadges(netWorth: number): Badge[]
- storage/core.ts: export function safeRead<T = any>(key: string, fallback: NoInfer<T>): T; export function safeWrite<T>(key: string, value: T): Result<null>; export function uid(): string; export function nowISO(): string; export function currentMonth(): string; export async function readStorage(key: string): Promise<any>; export async function writeStorage(key: string, data: any): Promise<void>; export async function deleteStorage(key: string): Promise<void>
- storage/goal.ts: export interface GoalProgress; export interface GoalInput; export function getGoal(): Goal | null; export function saveGoal(input: GoalInput): Result<Goal>; export function clearGoal(): void; export function computeGoalProgress(netWorth: number, today: Date = new Date()): GoalProgress
- storage/meta.ts: export function getMeta(): AppMeta; export function patchMeta(patch: Partial<AppMeta>): Result<AppMeta>
- storage/snapshots.ts: export function upsertSnapshot(snapshot: NetWorthSnapshot): Result<NetWorthSnapshot>; export function listSnapshots(count: number): NetWorthSnapshot[]; export function getPrevSnapshot(month: string): NetWorthSnapshot | null
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type AssetCategory = 'deposit' | 'stock' | 'realestate' | 'loan'; export const ASSET_CATEGORIES: readonly AssetCategory[] = ['deposit', 'stock', 'realestate', 'loan'] as const; export const CATEGORY_LABEL: Record<AssetCategory, string> =; export const LIABILITY_CATEGORIES: AssetCategory[] = ['loan']; export const AMOUNT_MIN = 1; export const AMOUNT_MAX = 999_999_999_999; export const ASSET_MAX_COUNT = 200; export const SNAPSHOT_MAX_COUNT = 60
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- AssetRowActions.tsx: AssetRowActions
- BadgeCelebrationSheet.tsx: BadgeCelebrationSheet
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CheckInBanner.tsx: CheckInBanner
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- GoalMiniCard.tsx: GoalMiniCard
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- ToastHost.tsx: ToastHost
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd

### Module Dependencies (import graph)
  pages/Home.tsx → imports: lib/store
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 · 상수 · RouteState 정의 (files: src/lib/types.ts)
- 0002: 저장소 코어 유틸 (안전 read/write, ID 폴백) (files: src/lib/storage/core.ts)
- 0003: 순자산 계산 · 금액 포맷터 (순수 함수) (files: src/lib/calc/summary.ts, src/lib/format.ts)
- 0004: 자산배분 진단 룰 엔진 (결정론적) (files: src/lib/calc/diagnose.ts)
- 0005: Asset CRUD 저장소 (files: src/lib/storage/assets.ts)
- 0006: 스냅샷 · 목표 · 뱃지 · 메타 저장소 (files: src/lib/storage/snapshots.ts, src/lib/storage/goal.ts, src/lib/storage/badges.ts, src/lib/storage/meta.ts)
- 0007: AppDataProvider + useAppData 훅 (files: src/lib/store.tsx)
- 0009: 홈 — 체크인 배너 · 목표 미니 카드 · 뱃지 축하 BottomSheet · AdSlot (files: src/components/CheckInBanner.tsx, src/components/GoalMiniCard.tsx, src/components/BadgeCelebrationSheet.tsx)
- 0011: 자산 목록 — 삭제 AlertDialog · Toast · 수정 진입 (files: src/components/AssetRowActions.tsx, src/components/ToastHost.tsx)