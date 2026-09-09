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
// Domain types — add your app-specific types here
export {};

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    storage.ts
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
  vite-env.d.ts

### Exports (src/lib/)
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.