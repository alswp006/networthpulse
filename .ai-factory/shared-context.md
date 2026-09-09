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

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/lib/contract.ts
export type Asset = { id: string; category: string; amount: number; date: string; memo?: string };
export type Snapshot = { id: string; date: string; netWorth: number; createdAt: string };
export type Goal = { id: string; label: string; targetAmount: number; deadline: string; achieved: boolean };
export type Badge = { id: string; type: string; unlocked: boolean; unlockedAt?: string; milestone: number };
export type RouteState = 'home' | 'assets' | 'trend' | 'report' | 'goal' | 'badges';
export type ASSET_CATEGORIESFn = readonly string[];
export type BADGE_MILESTONESFn = readonly number[];
export type readStorageFn = (key: string) => Promise<any>;
export type writeStorageFn = (key: string, data: any) => Promise<void>;
export type deleteStorageFn = (key: string) => Promise<voi

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(3), general(12), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)