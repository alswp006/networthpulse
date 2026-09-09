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

/** 현재 목표 조회 — 0007, 0009, 0018에서 사용 (구현: 패킷 0006) */
export type readGoalFn = () => Promise<Goal | null>;

/** 목표 저장 — 0018(목표 설정)에서 호출 (구현: 패킷 0006) */
export type writeGoalFn = (goal: Goal) => Promise<void>;

/** 뱃지 목록 — 0007, 0009, 0019에서 사용 (구현: 패킷 0006) */
export type listBadgesFn = () => Promise<Badge[]>;

/** 뱃지 동기화 — 0007(전역 훅)에서 호출 (구현: 패킷 0006) */
export type updateBadgesFn = (badges: Badge[]) => Promise<void>;

/** 메타데이터 조회 — 0007(초기화)에서 사용 (구현: 패킷 0006) */
export type readMetaFn = () => Promise<{ theme?: string; locale?: string }>;

/** 글로벌 앱 상태 훅 — 모든 페이지/컴포넌트(0008-0019)에서 사용 (구현: 패킷 0007) */
export type useAppDataFn = () => { assets: Asset[]; snapshots: Snapshot[]; goal: Goal | null; badges: Badge[]; loading: boolean; error?: Error };

/** 광고 표시 여부 판단 — 0008, 0009, 0015, 0017에서 사용 (구현: 패킷 0021) */
export type useAdVisibilityFn = (location: 'home' | 'trend' | 'report') => boolean;

/** 햅틱 피드백 발생 — 0009(뱃지 축하), 0011(삭제 확인)에서 호출 (구현: 패킷 0021) */
export type triggerHapticFn = (type: 'light' | 'medium' | 'heavy') => void;
