# TASK — NetWorthPulse

> SPEC `NetWorthPulse` → 구현 패킷 분해. 총 **25 태스크 / 5 에픽**.
> 순서 규칙: 타입 → 저장소 → 상태관리 → 페이지(1페이지 1태스크) → 통합/검수.
> 각 태스크 완료 시점마다 `tsc --noEmit` + `vite build`가 통과해야 한다(독립 컴파일 가능).

---

## Epic 1. TypeScript 타입 + 상수

**Risk Assessment**
- **Complexity**: Low
- **Risk factors**: (1) 페이지별로 `location.state` 모양이 제각각이 되어 결과·목록 화면이 undefined 크래시를 일으킴 (실사고 2026-08-03 SplitMate). (2) 에러 문구를 각 화면에서 하드코딩하면 SPEC의 "정확 일치 검증" 테스트가 전부 깨짐. (3) 카테고리 라벨/임계값이 여러 파일에 흩어져 F6·F7 계산이 불일치.
- **Mitigation**: 모든 런타임 코드보다 먼저 `types.ts` 하나에 엔티티·`RouteState`·`ERROR_MESSAGES`·`MILESTONES`를 단일 소스로 고정한다. 이후 모든 태스크는 이 파일을 import만 하고 재정의를 금지한다.

### Task 1.1 도메인 타입 · 상수 · RouteState 정의
- **Description**: 런타임 코드 없는 순수 타입/상수 모듈을 작성한다. `AssetCategory`, `CATEGORY_LABEL`, `LIABILITY_CATEGORIES`, `AMOUNT_MIN/MAX`, `ASSET_MAX_COUNT`, `SNAPSHOT_MAX_COUNT`, `Asset`, `AssetInput`, `NetWorthSnapshot`, `Goal`, `MilestoneId`, `Badge`, `AppMeta`, `NetWorthSummary`, `Result<T>`, `STORAGE_KEYS`(`nwp:assets:v1` 등 5개), `ERROR_MESSAGES`(SPEC 에러 문구 사전 12종 그대로), `MILESTONES`(id/threshold/label 8종 배열), `DIAGNOSIS_RULE_IDS`(6종), 그리고 **`RouteState`**를 export한다.
  ```ts
  export type RouteState = {
    "/": null;
    "/assets": { filterCategory?: AssetCategory; toast?: 'saved' | 'updated' | 'deleted' } | null;
    "/assets/new": { presetCategory?: AssetCategory } | null;
    "/assets/:id/edit": null;                     // id는 URL param
    "/trend": { initialRange?: 3 | 6 | 12 } | null;
    "/goal": { openEditor?: boolean } | null;
    "/badges": { highlightBadgeId?: MilestoneId } | null;
    "/report": null;                              // 해제 여부는 AppMeta로만 판단
  };
  ```
  파일 상단에 주석으로 수신 규약을 명시한다: *"수신 측은 `const s = (useLocation().state as RouteState['/x']) ?? null;` 후 `if (!s)` 분기 필수. `as` 캐스팅은 런타임 방어가 아니다."*
- **DoD**:
  - `src/lib/types.ts`가 위 심볼을 모두 export하고 `tsc --noEmit` 통과.
  - 파일에 `import` 문이 0개이고 함수/클래스 선언이 0개(순수 타입 + `as const` 상수만).
  - `ERROR_MESSAGES`의 12개 문자열이 SPEC 에러 문구 사전과 문자 단위로 일치.
  - `MILESTONES`가 정확히 8개이며 threshold 오름차순(`M_DEBT_FREE`는 threshold `null`).
  - HEX 색상 문자열 0건.
- **Covers**: (기반 태스크 — AC 직접 커버 없음. 이후 전 태스크가 이 파일에 의존)
- **Files**: `src/lib/types.ts`
- **Depends on**: none

---

## Epic 2. 데이터 레이어 (localStorage + 계산)

**Risk Assessment**
- **Complexity**: Medium
- **Risk factors**: (1) 손상된 JSON/`QuotaExceededError`를 UI 레이어에서 처리하려다 F8-AC4(콘솔 에러 0건)를 위반. (2) `computeSummary`의 반올림 규칙(93.8 / 37.5 / 63.5)이 화면마다 달라져 F1-AC2·F6-AC5 수치가 어긋남. (3) 스냅샷 upsert가 여러 곳에서 호출되며 중복 레코드 생성. (4) 뱃지 중복 부여로 배열이 무한 증가.
- **Mitigation**: 저장소 원시 접근(Task 2.1)을 단 한 곳으로 좁혀 모든 CRUD가 이를 경유하게 하고, 계산(2.3)과 저장(2.2/2.4/2.5/2.6/2.7)을 분리한다. 순수 함수라 UI 없이 단위 테스트가 가능하므로 페이지 태스크 착수 전 수치가 확정된다.

### Task 2.1 저장소 코어 유틸 (안전 read/write, ID 폴백)
- **Description**: `safeRead<T>(key, fallback)`, `safeWrite(key, value): Result<null>`, `uid()`, `nowISO()`, `currentMonth()`(`YYYY-MM`)를 구현한다. `safeRead`는 파싱 실패 시 예외를 던지지 않고 fallback을 반환하며 해당 키를 fallback으로 재초기화하고 `console.error`를 호출하지 않는다(`console.warn`도 금지). `safeWrite`는 `QuotaExceededError`를 catch해 `{ ok:false, error: ERROR_MESSAGES.QUOTA }`를 반환하고 기존 값을 건드리지 않는다. `uid()`는 `crypto.randomUUID` 미지원 시 `Date.now().toString(36) + Math.random().toString(36).slice(2,10)` 폴백.
- **DoD**:
  - `localStorage.setItem('nwp:assets:v1','{broken')` 후 `safeRead('nwp:assets:v1', [])` → `[]` 반환 + 키 값이 `'[]'`로 교체, throw·console 출력 0건.
  - `setItem`을 `QuotaExceededError` throw로 스텁했을 때 `safeWrite`가 `{ok:false, error:'저장 공간이 부족해요. 오래된 항목을 삭제해주세요'}` 반환.
  - `crypto` 전역을 삭제한 환경에서 `uid()`가 길이 8자 이상 문자열을 반환하고 1,000회 호출 시 중복 0건.
  - `Array.prototype.at` / `Object.groupBy` / `structuredClone` / 정규식 lookbehind 미사용.
- **Covers**: [F1-AC4, F1-AC5(저장 실패 처리), F8-AC5(ID 폴백)]
- **Files**: `src/lib/storage/core.ts`
- **Depends on**: Task 1.1

### Task 2.2 Asset CRUD
- **Description**: `listAssets()`, `createAsset(input): Result<Asset>`, `updateAsset(id, patch): Result<Asset>`, `deleteAsset(id): Result<{id}>`, `getAsset(id): Asset | null`을 구현한다. 검증 순서: name trim 후 빈 문자열 또는 amount < 1 → `이름과 금액을 확인해주세요` / name 길이 > 20 → `이름은 20자까지 입력할 수 있어요` / amount > 999,999,999,999 → `금액은 999,999,999,999원까지 입력할 수 있어요` / 기존 200건 → `자산은 최대 200개까지 등록할 수 있어요`. 저장은 Task 2.1의 `safeWrite`만 사용.
- **DoD**:
  - 빈 저장소에서 `createAsset({name:'국민은행 예금',category:'deposit',amount:12000000,memo:'비상금'})` → `ok:true`, `data.id !== ''`, `createdAt === updatedAt`, 저장 배열 길이 1, `amount === 12000000`.
  - `updateAsset('a1',{amount:7000000})` 후 `updatedAt !== createdAt`, 이어서 `deleteAsset('a1')` 후 `listAssets().length === 0`.
  - `createAsset({name:'  ',category:'deposit',amount:0,memo:''})` → `{ok:false, error:'이름과 금액을 확인해주세요'}`이고 `localStorage` 쓰기 호출 0건.
  - 200건 상태에서 create → `{ok:false, error:'자산은 최대 200개까지 등록할 수 있어요'}`, 배열 길이 200 유지.
  - quota 스텁 상태에서 create → `ok:false` + 기존 배열 내용 불변(깊은 비교 일치).
  - 존재하지 않는 id로 `updateAsset`/`getAsset` 호출 시 throw 없이 `{ok:false, error:'항목을 찾을 수 없어요'}` / `null` 반환.
- **Covers**: [F1-AC1, F1-AC3, F1-AC5, F1-AC6, F1-AC8]
- **Files**: `src/lib/storage/assets.ts`
- **Depends on**: Task 2.1

### Task 2.3 순자산 계산 · 금액 포맷터
- **Description**: `computeSummary(assets, prev?)`와 포맷 유틸 `formatKRW(n)`(3자리 콤마 + '원'), `formatCompactKRW(n)`(1억 이상 `1억 2,340만원`), `formatSignedKRW(n)`, `formatPercent(n)`(소수 1자리)를 구현한다. `categoryRatio`는 총자산(부채 제외) 기준 소수 1자리 반올림, `debtRatio = totalLiabilities/totalAssets*100`(총자산 0이면 0), `momDelta`는 `prev` 없으면 `null`.
- **DoD**:
  - SPEC F1-AC2 입력으로 `totalAssets===320000000`, `totalLiabilities===120000000`, `netWorth===200000000`, `categoryRatio.realestate===93.8`, `debtRatio===37.5`.
  - `computeSummary([])` → `netWorth===0`, `debtRatio===0`, `momDelta===null`, 4개 `categoryRatio` 전부 `0`, NaN 값 0개(`Object.values(...).every(Number.isFinite)`).
  - F6-AC5 입력(`deposit 5,000,000 / stock 10,000,000 / realestate 300,000,000 / loan 200,000,000`)으로 `debtRatio === 63.5`.
  - `formatCompactKRW(123400000) === '1억 2,340만원'`, `formatKRW(-35000000) === '-35,000,000원'`.
  - 순수 함수 — localStorage 접근 0건.
- **Covers**: [F1-AC2, F1-AC7]
- **Files**: `src/lib/calc/summary.ts`, `src/lib/format.ts`
- **Depends on**: Task 1.1

### Task 2.4 스냅샷 저장소 (upsert / range 조회)
- **Description**: `upsertSnapshot(summary, month): Result<NetWorthSnapshot>`와 `listSnapshots(range: 3|6|12): NetWorthSnapshot[]`, `getPrevSnapshot(month): NetWorthSnapshot | null`을 구현한다. 배열은 항상 `month` 오름차순 유지, 동일 month는 덮어쓰기, 60건 초과 시 앞에서부터 제거.
- **DoD**:
  - `2026-09` 레코드가 없을 때 upsert → 배열 길이 +1, `{month:'2026-09', netWorth:<계산값>, capturedAt:<ISO>}` 생성.
  - 같은 달 재호출 → 배열 길이 불변, `netWorth`/`capturedAt`만 갱신(`month` 중복 0건).
  - 61건 삽입 후 길이 60, 가장 오래된 month가 제거됨.
  - `listSnapshots(6)`가 최근 6개 이하를 오름차순으로 반환하고, 데이터 4개면 4개 반환.
  - 손상 JSON 상태에서 `listSnapshots(12)` → `[]`, throw·console 출력 0건.
- **Covers**: [F4-AC1(저장 로직)]
- **Files**: `src/lib/storage/snapshots.ts`
- **Depends on**: Task 2.1, Task 2.3

### Task 2.5 목표 저장소 + 달성률 계산
- **Description**: `getGoal()`, `saveGoal({targetAmount,targetDate}): Result<Goal>`, `clearGoal(): Result<null>`와 순수 계산 `computeGoalProgress(goal, netWorth, today)`를 구현한다. 반환: `{ percent, remaining, surplus, monthsLeft, monthlyNeeded, achieved }`. `percent`는 0~100 클램프 소수 1자리, `monthsLeft`는 today→targetDate 개월 수(최소 1), `monthlyNeeded = floor(remaining / monthsLeft)`.
- **DoD**:
  - `saveGoal({targetAmount:500000000, targetDate:'2030-12-31'})` → `ok:true`, `nwp:goal:v1`에 저장.
  - `targetAmount:0` → `{ok:false, error:'목표 금액을 1원 이상 입력해주세요'}`, `1000000000000` → `{ok:false, error:'목표 금액은 999,999,999,999원까지 입력할 수 있어요'}`.
  - today `2026-09-10`에서 `targetDate:'2026-09-09'` → `{ok:false, error:'목표 날짜는 오늘 이후로 정해주세요'}`, 저장 미발생.
  - target 500,000,000 / netWorth 200,000,000 → `percent===40.0`, `remaining===300000000`.
  - today `2026-09-10`, target date `2028-09-30`, remaining 300,000,000 → `monthsLeft===24`, `monthlyNeeded===12500000`.
  - netWorth 600,000,000 ≥ target 500,000,000 → `percent===100.0`, `achieved===true`, `surplus===100000000`.
  - netWorth `-10000000` → `percent===0.0`, `Number.isNaN(percent)===false`.
- **Covers**: [F5-AC1(저장), F5-AC3(계산), F5-AC5, F5-AC6, F5-AC7(계산), F5-AC8(계산)]
- **Files**: `src/lib/storage/goal.ts`, `src/lib/calc/goal.ts`
- **Depends on**: Task 2.1, Task 2.3

### Task 2.6 뱃지 저장소 + evaluateBadges
- **Description**: `listBadges()`, `evaluateBadges(summary, assetCount): Badge[]`(신규 획득분만 반환하며 내부에서 저장까지 수행)를 구현한다. 이미 보유한 id는 재평가 대상에서 제외하고 `achievedAt`을 갱신하지 않는다. `M_DEBT_FREE`는 `assetCount >= 1 && totalLiabilities === 0`.
- **DoD**:
  - 보유 `['M_FIRST_RECORD']` + netWorth 105,000,000 → 반환 배열이 `['M_10M','M_50M','M_100M']`(임계값 오름차순), 저장소 총 4건.
  - `M_100M` 보유 상태에서 netWorth 30,000,000로 재평가 → 반환 `[]`, `M_100M` 레코드 유지 + `achievedAt` 문자열 불변.
  - 자산 2건 · `totalLiabilities===0` → `M_DEBT_FREE` 부여. 이후 loan 1건 추가해 재평가 시 반환에 `M_DEBT_FREE` 없음 + 기존 레코드 유지.
  - `M_10M` 보유 상태에서 evaluate 3회 반복 → `badges.filter(b=>b.id==='M_10M').length === 1`, 배열 길이 불변.
  - 자산 0건 → 어떤 뱃지도 부여되지 않음(`M_FIRST_RECORD` 포함).
- **Covers**: [F7-AC1, F7-AC4, F7-AC5, F7-AC6]
- **Files**: `src/lib/storage/badges.ts`
- **Depends on**: Task 2.1, Task 2.3

### Task 2.7 AppMeta 저장소
- **Description**: `getMeta(): AppMeta`(키 없으면 `{lastCheckInAt:null, reportUnlockedMonth:null, schemaVersion:1}` 기본값), `patchMeta(patch): Result<AppMeta>`, 파생 헬퍼 `isCheckInDue(meta, today): boolean`(`lastCheckInAt`이 null이거나 7일 이상 경과), `isReportUnlocked(meta, month): boolean`을 구현한다.
- **DoD**:
  - 키 부재 상태에서 `getMeta()`가 기본값 객체 반환, throw 0건.
  - `patchMeta({lastCheckInAt:'2026-09-10T00:00:00.000Z'})` 후 `reportUnlockedMonth`가 보존됨(부분 갱신).
  - `lastCheckInAt='2026-09-01'`, today `2026-09-10` → `isCheckInDue===true`; `2026-09-05` → `false`; `null` → `true`.
  - `reportUnlockedMonth='2026-09'`, month `'2026-09'` → `isReportUnlocked===true`, `'2026-10'` → `false`.
  - quota 스텁에서 `patchMeta` → `{ok:false}` 반환, throw 0건.
- **Covers**: [F3-AC3(체크인 판정/갱신), F3-AC4, F6-AC1(해제 저장), F6-AC3(해제 판정)]
- **Files**: `src/lib/storage/meta.ts`
- **Depends on**: Task 2.1

### Task 2.8 자산배분 진단 룰 엔진
- **Description**: `diagnose(summary): { id: DiagnosisRuleId; text: string }[]`를 구현한다. SPEC 룰 테이블 6종을 표 순서(`R_DEBT_HIGH → R_DEBT_OK → R_RE_HEAVY → R_CASH_LOW → R_STOCK_HEAVY`)로 평가해 일치 항목을 배열로 모으고, 하나도 없으면 `R_BALANCED` 단일 항목을 반환한다. 문구는 SPEC과 문자 단위 동일.
- **DoD**:
  - F6-AC5 입력 → 결과 id 배열이 정확히 `['R_DEBT_HIGH','R_RE_HEAVY','R_CASH_LOW']`(순서 포함)이고 `R_BALANCED` 미포함.
  - `debtRatio 20 / deposit 30% / stock 30% / realestate 40%` → `['R_DEBT_OK']`.
  - 모든 룰 불일치 입력 → `['R_BALANCED']` 길이 1.
  - 순수 함수 — localStorage·React import 0건, 생성형 AI 호출 0건.
- **Covers**: [F6-AC5(계산)]
- **Files**: `src/lib/calc/diagnosis.ts`
- **Depends on**: Task 2.3

---

## Epic 3. 상태 관리

**Risk Assessment**
- **Complexity**: Medium
- **Risk factors**: (1) 각 페이지가 개별적으로 localStorage를 읽으면 저장 직후 다른 탭의 값이 갱신되지 않아 홈/추이/리포트 수치가 서로 다르게 표시됨. (2) 스냅샷 upsert·뱃지 평가를 페이지마다 호출하면 중복 실행/중복 부여. (3) 초기 렌더에 `0원`이 깜빡여 F3-AC6 위반.
- **Mitigation**: 단일 Provider가 로드·파생계산·쓰기 후처리(스냅샷 upsert → 뱃지 평가 → pendingBadge 큐)를 전담한다. 페이지 태스크는 훅만 소비하므로 로직 중복이 구조적으로 불가능하다.

### Task 3.1 AppDataProvider + useAppData 훅
- **Description**: React Context Provider를 구현한다. 마운트 시 assets/snapshots/goal/badges/meta를 로드하고 `status: 'loading' | 'ready' | 'error'`를 노출한다. 제공 값: `assets`, `summary`(`computeSummary(assets, prevSnapshot)`, `useMemo`), `snapshots`, `goal`, `badges`, `meta`, `pendingBadge`, `reload()`, 그리고 mutation 래퍼 `addAsset/editAsset/removeAsset/setGoal/removeGoal/markCheckIn/unlockReport`. 모든 asset mutation은 성공 시 **① 상태 갱신 → ② `upsertSnapshot(summary, currentMonth())` → ③ `evaluateBadges()` → ④ 신규 뱃지 첫 항목을 `pendingBadge`에 적재** 순으로 실행하고 `Result`를 그대로 반환한다. 앱 부팅 시 `getIsTossLoginIntegratedService()`를 1회 호출해 결과만 상태에 보관(로그 출력 없음). 초기 진입 시에도 `upsertSnapshot`을 1회 실행한다.
- **DoD**:
  - 첫 렌더 프레임에서 `status === 'loading'`이고 `summary`는 `null`(숫자 `0` 노출 없음), 로드 후 `'ready'`.
  - `addAsset` 성공 후 `snapshots`에 현재 월 레코드가 존재하고 같은 달 2회 저장 시 레코드 수가 증가하지 않는다.
  - `addAsset`으로 netWorth가 105,000,000이 되면 `pendingBadge?.id === 'M_10M'`이고, `clearPendingBadge()` 호출 후 `null`.
  - `addAsset`이 `{ok:false}`를 반환하면 스냅샷·뱃지 부수효과가 실행되지 않는다(호출 스파이 0건).
  - Provider 내부에서 `console.error` 호출 0건, 미처리 Promise rejection 0건.
  - 이 태스크만 적용한 상태에서 `vite build` 통과(아직 소비하는 페이지가 없어도 무방).
- **Covers**: [F4-AC1(자동 upsert 연동), F7-AC2(신규 획득 감지)]
- **Files**: `src/state/AppDataProvider.tsx`, `src/state/useAppData.ts`
- **Depends on**: Task 2.2, Task 2.3, Task 2.4, Task 2.5, Task 2.6, Task 2.7

---

## Epic 4. UI 페이지

**Risk Assessment**
- **Complexity**: High
- **Risk factors**: (1) `location.state` 없이 직접 진입(새로고침·딥링크) 시 `state.filterCategory` 접근으로 즉시 크래시 — 실사고 2026-08-03 SplitMate에서 완주율 0%를 유발한 패턴. (2) TDS 컴포넌트에 Tailwind/인라인 padding을 덮어써 검수 반려. (3) SVG 차트에서 max-min=0 또는 음수 범위로 NaN 좌표 발생. (4) 200건 리스트 전량 렌더로 스크롤 프레임 드랍. (5) HEX 하드코딩으로 다크모드 대비 붕괴.
- **Mitigation**: Task 1.1의 `RouteState`를 모든 페이지가 import하고 **캐스팅 후 즉시 null 가드**하는 것을 각 태스크 DoD에 개별 항목으로 못박았다. 차트 엣지케이스(4.7)와 리스트 가상화(4.1)를 별도 태스크로 분리해 검증 누락을 막고, 데이터 레이어가 이미 확정된 뒤 렌더만 담당하므로 페이지 태스크가 10분 안에 끝난다.

> 전 페이지 공통 DoD(모든 4.x 태스크에 자동 적용): `ScreenScaffold`로 감싼다 · `@toss/tds-mobile` 외 UI 라이브러리 import 0건 · TDS 컴포넌트에 `style`/`className`으로 margin·padding 지정 0건(간격은 `Spacing size` 사용) · `#RRGGBB` 정규식(`#[0-9a-fA-F]{3,8}\b`) 매칭 0건 · 인터랙티브 요소 최소 44×44px · `console.error` 0건.

### Task 4.1 자산 목록 화면 — 리스트 · 합계 · 탭 필터 · 빈/로딩
- **Description**: `/assets` 페이지를 구현한다. `Top`(타이틀 "자산", 우측 "추가" 44×44px), `Tab`(전체/예금/주식/부동산/대출), 상단 고정 `Card data-testid="assets-total-card"`(총자산·총부채·순자산), `react-window` 가상 리스트(행 높이 72px, overscan 5, `ListRow` 좌: 이름·메모 / 우: 금액). 진입 state는 `const s = (useLocation().state as RouteState['/assets']) ?? null;` 로 받아 `s?.filterCategory`가 있으면 해당 탭 초기 선택, 없으면 "전체". `s?.toast`가 있으면 대응 Toast 1회 노출 후 `navigate('/assets',{replace:true, state:null})`로 state 소거. 삭제/수정 인터랙션은 Task 4.2에서 추가한다.
- **DoD**:
  - `listAssets()` 길이 0 → `Asset.ContentIcon` + "아직 등록한 자산이 없어요" + `display="block"` "자산 추가하기" 버튼이 표시되고 삭제/수정 버튼 DOM 0개.
  - `status==='loading'` 프레임에 ListRow Skeleton 5개 표시, 실제 금액 텍스트 0건.
  - 자산 200건 상태에서 초기 렌더 시 문서 내 `ListRow` 요소 수 ≤ 30.
  - `navigate('/assets',{state:{filterCategory:'stock'}})` 진입 시 "주식" 탭이 활성.
  - **state 없이 `/assets`로 직접 진입해도 크래시하지 않고 "전체" 탭 목록이 렌더된다**(브라우저 새로고침 시나리오 포함).
  - 리스트 하단·FloatingTabBar 위에 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 1회만 렌더.
- **Covers**: [F2-AC6, F2-AC8]
- **Files**: `src/pages/AssetsPage.tsx`, `src/pages/assets/AssetRow.tsx`
- **Depends on**: Task 3.1

### Task 4.2 자산 목록 — 삭제 AlertDialog · 행 탭 수정 진입
- **Description**: `AssetRow`에 우측 삭제 아이콘 버튼(44×44px)과 행 전체 탭(→ `/assets/{id}/edit`, state 없음)을 추가하고, 삭제 시 TDS `AlertDialog`("삭제할까요?")를 띄운다. 확인 시 `removeAsset(id)` 호출 후 Toast "삭제했어요", 취소 시 저장소 변경 0건.
- **DoD**:
  - 삭제 버튼 탭 → AlertDialog 노출, "삭제" 탭 → 항목 제거 + Toast "삭제했어요" + 리스트에서 행 사라짐.
  - "취소" 탭 → `listAssets()` 결과가 탭 이전과 깊은 비교로 동일.
  - 삭제 성공 후 현재 월 스냅샷 `netWorth`가 재계산 값으로 갱신됨(레코드 수 불변).
  - 삭제 버튼 실측 크기 ≥ 44×44px이며 행 탭 핸들러로 이벤트가 전파되지 않는다(삭제 탭 시 편집 화면으로 이동하지 않음).
  - 빈 목록에서는 AlertDialog 트리거가 DOM에 없다.
- **Covers**: [F2-AC3]
- **Files**: `src/pages/assets/AssetRow.tsx`, `src/pages/AssetsPage.tsx`
- **Depends on**: Task 4.1

### Task 4.3 자산 추가 폼 — `/assets/new`
- **Description**: 카테고리 `Chip` 4종 단일 선택 + `TextField` 3개(이름/금액/메모) + `SubmitFooter`("저장", 하단 고정 + `env(safe-area-inset-bottom)`)를 구현한다. 금액 필드는 `inputMode="numeric"`, 실시간 3자리 콤마 포맷, 저장 시 콤마 제거 정수 변환. 이름은 20자 초과 입력 차단. 검증 실패 시 필드 하단 `Paragraph.Text` 인라인 에러(문구는 `ERROR_MESSAGES` 사용). 저장 성공 시 `navigate('/assets',{replace:true,state:{toast:'saved'}})`. 진입 state는 `(useLocation().state as RouteState['/assets/new']) ?? null` 후 `s?.presetCategory`로 Chip 초기 선택.
- **DoD**:
  - Chip "주식" 선택 + `{name:'삼성전자', amount:8500000, memo:'장기보유'}` 저장 → 저장소에 항목 추가, Toast "저장했어요", `/assets` 이동 후 "주식" 섹션에 `삼성전자 · 8,500,000원` 행 표시.
  - amount 0 저장 시도 → 필드 하단에 "금액을 1원 이상 입력해주세요" 표시, 저장소 변경 0건, `location.pathname === '/assets/new'` 유지.
  - name에 21번째 글자 입력 시 값이 20자로 유지되고 "이름은 20자까지 입력할 수 있어요" 표시.
  - amount `1000000000000` 저장 시도 → "금액은 999,999,999,999원까지 입력할 수 있어요" 표시.
  - amount 필드 `inputMode==='numeric'`, `8500000` 입력 중 화면 표시값이 `8,500,000`, 포커스 시 `scrollIntoView({block:'center'})` 호출.
  - SubmitFooter가 `position:fixed` + `padding-bottom: env(safe-area-inset-bottom)`이며 폼 내부 `AdSlot` 0개.
  - **state 없이 `/assets/new` 직접 진입 시 크래시 없이 Chip 미선택(또는 '예금' 기본) 상태로 렌더된다.**
- **Covers**: [F2-AC1, F2-AC4, F2-AC5, F2-AC7]
- **Files**: `src/pages/AssetFormPage.tsx`, `src/pages/assets/AmountField.tsx`
- **Depends on**: Task 3.1

### Task 4.4 자산 수정 — `/assets/:id/edit` + 잘못된 id 폴백
- **Description**: 4.3의 폼을 edit 모드로 재사용한다. URL param `id`로 `getAsset(id)` 조회 → 존재하면 프리필, `null`이면 Toast "항목을 찾을 수 없어요" 후 즉시 `navigate('/assets',{replace:true})`(빈 폼 렌더 금지). 조회 중에는 TextField Skeleton 3개. 저장 시 `editAsset`, 성공 Toast "수정했어요" + `navigate('/assets',{replace:true,state:{toast:'updated'}})`. 값 변경 후 뒤로가기 시 AlertDialog "저장하지 않고 나갈까요?".
- **DoD**:
  - 기존 값 `{name:'삼성전자',amount:8500000}`이 프리필되고 amount를 `9200000`으로 수정 저장 시 해당 항목 `amount===9200000`, `updatedAt !== createdAt`, Toast "수정했어요".
  - `/assets/does-not-exist/edit` 진입 → Toast "항목을 찾을 수 없어요" + `/assets`로 replace 이동, 빈 TextField가 한 프레임도 렌더되지 않는다.
  - 값 변경 후 `Top` 뒤로가기 탭 → AlertDialog 노출, "나가기" 선택 시에만 이동.
  - Top 타이틀이 "자산 수정"(new 모드는 "자산 추가").
- **Covers**: [F2-AC2, F8-AC7]
- **Files**: `src/pages/AssetFormPage.tsx`
- **Depends on**: Task 4.3

### Task 4.5 홈 대시보드 — hero · 카테고리 Card · 빈/로딩
- **Description**: `/` 페이지의 핵심 영역을 구현한다. `Top`("순자산") > `SummaryHero data-testid="networth-hero"`(순자산 t2, CountUp 0→값 800ms, 전월 대비 배지) > `Spacing size={16}` > `Card data-testid="category-breakdown"`(4개 카테고리 `MiniBar` + 비중 %). 최근 6개월 스냅샷 2개 이상이면 hero 하단 `Sparkline`. 카테고리 행(높이 56px) 탭 → `navigate('/assets',{state:{filterCategory}})`. 홈은 항상 state 없이 진입 가능해야 한다.
- **DoD**:
  - 자산 1건 이상 → `data-testid="networth-hero"`와 `data-testid="category-breakdown"`이 각각 1개 존재, MiniBar 4개(예금/주식/부동산/대출).
  - 전월 스냅샷 180,000,000 / 현재 200,000,000 → hero 하단에 `+20,000,000원 (+11.1%)` 텍스트 + 상승 배지, 감소 시 `-` 부호 + 하락 배지.
  - 자산 0건 → hero 미렌더, `Asset.ContentIcon` + "첫 자산을 등록하고 순자산을 확인해보세요" + `display="block"` "자산 추가하기"만 표시되고 MiniBar 섹션 DOM 0개.
  - `status==='loading'` 프레임에 높이 96px Skeleton 1개 + ListRow Skeleton 3개 표시, 문자열 `0원` 렌더 0건.
  - 스냅샷 1개 이하일 때 `Sparkline` 미렌더.
  - `/`에 state 없이 진입해도 크래시 없음(홈은 `location.state`를 읽지 않는다 — 소스에 `useLocation().state` 참조 0건).
- **Covers**: [F3-AC1, F3-AC2, F3-AC5, F3-AC6]
- **Files**: `src/pages/HomePage.tsx`, `src/components/CategoryBreakdown.tsx`
- **Depends on**: Task 3.1

### Task 4.6 홈 — 체크인 배너 · 목표 미니 카드 · 뱃지 축하 BottomSheet · AdSlot
- **Description**: 홈에 조건부 `Card data-testid="checkin-banner"`(`isCheckInDue`일 때만, "7일 동안 자산을 업데이트하지 않았어요" + "지금 업데이트" 버튼 48px → `markCheckIn()` 후 `navigate('/assets')`), `Card data-testid="goal-mini-card"`(달성률 요약, 미설정 시 CTA, 탭 → `/goal`), 뱃지 아이콘 버튼 44×44px(→ `/badges`), `pendingBadge` 존재 시 축하 `BottomSheet`, 그리고 카테고리 Card 아래·FloatingTabBar 위 `AdSlot`을 추가한다.
- **DoD**:
  - `lastCheckInAt='2026-09-01'`, today `2026-09-10` → `data-testid="checkin-banner"` 1개 표시, 버튼 높이 48px, 탭 시 `/assets` 이동 + `lastCheckInAt`이 현재 시각으로 갱신.
  - `lastCheckInAt`이 7일 미만 → `data-testid="checkin-banner"` DOM 0개.
  - `pendingBadge.id==='M_100M'` → BottomSheet 1회 열림, "1억원 달성!" 문구 + "확인" 버튼 48px. 확인 탭 후 재마운트해도 같은 뱃지로 다시 열리지 않는다(저장소 기반 판정).
  - `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 홈에 정확히 1회, 카테고리 Card 다음·FloatingTabBar 이전 순서로 렌더되고 컨테이너가 `position: static`이라 어떤 요소와도 겹치지 않는다.
  - 광고 로드 실패 시 광고 컨테이너 높이가 0px로 축소되고 회색 박스가 남지 않으며 `console.error` 0건, 나머지 콘텐츠 정상 표시.
- **Covers**: [F3-AC3, F3-AC4, F3-AC7, F3-AC8, F7-AC2]
- **Files**: `src/pages/HomePage.tsx`, `src/components/CheckInBanner.tsx`, `src/components/BadgeCelebrationSheet.tsx`
- **Depends on**: Task 4.5

### Task 4.7 추이 화면 — SVG 라인차트 + 엣지케이스
- **Description**: `/trend`의 `Card data-testid="trend-chart-card"`와 커스텀 SVG(`data-testid="trend-line-chart"`, 높이 200px, `<polyline>` + 포인트 `<circle r=3>` + 투명 `<rect>` 히트박스 44×44px → 툴팁)를 구현한다. Y축 범위는 `min===max`일 때 라인을 `y=height/2` 수평선으로, 음수 포함 시 하한을 음수까지 확장하고 0 기준선을 점선으로 그린다. 색상은 `var(--tds-color-*)`만 사용. 카드 상단에 최신 순자산 t3 강조.
- **DoD**:
  - 스냅샷 3개 → `<polyline>` points 좌표쌍 개수 === 3, 카드 상단에 최신 순자산 t3 표시.
  - 12개 스냅샷 netWorth가 모두 100,000,000 → points 문자열에 `NaN` 0건이고 모든 y값 === `height/2`.
  - `netWorth:-35000000` 포함 → y축 하한 < 0, 0 기준선 `stroke-dasharray` 요소 1개 존재, NaN 0건.
  - 스냅샷 0개 또는 1개 → `Asset.ContentIcon` + "2개월 이상 기록하면 추이를 볼 수 있어요" 표시, `data-testid="trend-line-chart"` DOM 0개.
  - 로딩 프레임에 높이 200px Skeleton 표시, 축 라벨 텍스트 0건.
  - SVG 내 `#` HEX 색상 0건, `fill`/`stroke` 값이 모두 `var(--tds-color-*)`.
- **Covers**: [F4-AC2, F4-AC4, F4-AC5, F4-AC6, F4-AC7(차트 축)]
- **Files**: `src/pages/TrendPage.tsx`, `src/components/TrendLineChart.tsx`
- **Depends on**: Task 3.1

### Task 4.8 추이 화면 — 기간 Tab · 월별 목록 · AdSlot
- **Description**: `/trend`에 `Tab`(3개월/6개월/12개월, 각 44px)과 차트 Card 아래 `AdSlot`, 그 아래 월별 `ListRow` 목록(월 · 순자산 · 전월 대비 증감 `Chip`)을 추가한다. 진입 state는 `(useLocation().state as RouteState['/trend']) ?? null` → `s?.initialRange ?? 6`.
- **DoD**:
  - "6개월" 탭 탭 시 차트 포인트 수가 `min(6, 스냅샷 수)`, 스냅샷이 4개면 4개 포인트 + "데이터 4개월치" 캡션 표시.
  - 기본 진입 시 활성 탭이 "6개월", `state:{initialRange:12}` 진입 시 "12개월" 활성.
  - **state 없이 `/trend` 직접 진입해도 크래시하지 않고 6개월 탭으로 렌더된다.**
  - 월별 목록에 `netWorth:-35000000` 행이 `-35,000,000원`으로 표시.
  - `<AdSlot />`이 차트 Card와 월별 목록 사이에 정확히 1회 렌더되며 두 요소와 겹치지 않는다.
- **Covers**: [F4-AC3, F4-AC7(목록 표기), F4-AC8]
- **Files**: `src/pages/TrendPage.tsx`
- **Depends on**: Task 4.7

### Task 4.9 목표 편집 모드 — `/goal` 폼
- **Description**: 목표 금액 `TextField`(`inputMode="numeric"` + 실시간 콤마) + 목표 날짜 `<input type="date">` + `SubmitFooter`("목표 저장")로 구성된 편집 모드를 구현한다. 검증 에러는 `ERROR_MESSAGES` 문구로 인라인 표시. 저장 성공 시 Toast "목표를 저장했어요" + 화면 내 상태 전환으로 조회 모드 진입(라우팅 없음). 진입 state는 `(useLocation().state as RouteState['/goal']) ?? null` → `s?.openEditor === true`면 편집 모드, 아니면 조회 모드(목표 없으면 빈 상태).
- **DoD**:
  - `{targetAmount:500000000, targetDate:'2030-12-31'}` 저장 → `nwp:goal:v1` 저장 + Toast "목표를 저장했어요" + 게이지(조회) 모드 전환.
  - today `2026-09-10`에 `2026-09-09` 입력 저장 → "목표 날짜는 오늘 이후로 정해주세요" 인라인 표시, 저장소 변경 0건.
  - `0` 입력 → "목표 금액을 1원 이상 입력해주세요", `1000000000000` 입력 → "목표 금액은 999,999,999,999원까지 입력할 수 있어요".
  - 목표 금액 입력 중 표시값이 3자리 콤마 포맷, 저장 값은 정수.
  - 검증 실패 상태에서 SubmitFooter 버튼 `disabled`.
  - **state 없이 `/goal` 직접 진입 시 크래시 없이 조회 모드(목표 미설정이면 빈 상태)로 렌더된다.**
- **Covers**: [F5-AC1, F5-AC5, F5-AC6]
- **Files**: `src/pages/GoalPage.tsx`, `src/pages/goal/GoalEditor.tsx`
- **Depends on**: Task 3.1

### Task 4.10 목표 조회 모드 — 게이지 · 플랜 Card · 빈 상태
- **Description**: `Card data-testid="goal-gauge-card"`(달성률 t2 CountUp + 커스텀 게이지 바 `role="progressbar"` + "남은 금액"/"초과" 텍스트 + 달성 `Chip`)와 `Card data-testid="goal-plan-card"`(목표 금액 / 목표일 / 월 필요 저축액 `ListRow` 3행), `Button display="block"` "목표 수정"(높이 52px), 삭제 아이콘 버튼 44×44px + 삭제 확인 AlertDialog, 빈 상태를 구현한다. 수치는 전부 Task 2.5의 `computeGoalProgress` 결과만 사용(화면 내 재계산 금지).
- **DoD**:
  - target 500,000,000 / netWorth 200,000,000 → `data-testid="goal-gauge-card"` 안에 `40.0%` t2 표시, 진행 바 `aria-valuenow==="40"`, "남은 금액 300,000,000원" 표시.
  - today `2026-09-10`, targetDate `2028-09-30` → "매월 12,500,000원씩 모으면 달성" 표시.
  - netWorth 600,000,000 ≥ target 500,000,000 → `100.0%` + "목표를 달성했어요" 배지가 게이지 상단에, "남은 금액" 대신 "초과 100,000,000원" 표시.
  - netWorth `-10000000` → `0.0%`, 진행 바 인라인 width `0%`, 화면 텍스트에 `NaN` 0건.
  - 목표 미설정 → 게이지 미렌더 + `Asset.ContentIcon` + "목표를 정하면 달성률을 볼 수 있어요" + `display="block"` "목표 설정하기".
  - 로딩 프레임에 Card Skeleton 2개.
- **Covers**: [F5-AC2, F5-AC3, F5-AC4, F5-AC7, F5-AC8]
- **Files**: `src/pages/GoalPage.tsx`, `src/components/GoalGauge.tsx`
- **Depends on**: Task 4.9

### Task 4.11 리포트 게이팅 — `/report` 잠금/해제 플로우
- **Description**: `AppMeta.reportUnlockedMonth === currentMonth()` 여부로만 게이팅을 판정한다(`location.state` 기반 우회 금지). 잠금 상태: `Card`("광고를 보면 이번 달 리포트가 열려요") + `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 감싼 `Button display="block"` "리포트 보기"(높이 52px). 시청 완료 → `unlockReport(currentMonth())` 후 본문 표시. 실패/중도이탈 → Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" + 잠금 유지. 자산 0건이면 광고를 로드하지 않고 빈 상태만 표시.
- **DoD**:
  - `reportUnlockedMonth !== '2026-09'` → `data-testid="report-body"` DOM 0개, 잠금 Card + "리포트 보기" 버튼만 표시.
  - "리포트 보기" → 광고 시청 완료 시 `data-testid="report-body"` 표시 + `reportUnlockedMonth === '2026-09'` 저장.
  - `reportUnlockedMonth === '2026-09'`, today `2026-09-20` 진입 → 광고 SDK 호출 0건으로 즉시 본문 표시.
  - 광고 실패 스텁 → 지정 Toast 문구 정확 일치, `reportUnlockedMonth` 불변, 본문 미표시, `console.error` 0건, 미처리 rejection 0건.
  - 자산 0건 → `Asset.ContentIcon` + "자산을 1개 이상 등록하면 리포트를 만들 수 있어요" + "자산 추가하기"(→ `/assets/new`, state 없음), `TossRewardAd` DOM 0개.
  - **state 없이 `/report` 직접 진입해도 크래시 없이 저장소 기준 잠금/해제 상태로 렌더된다.**
- **Covers**: [F6-AC1, F6-AC2, F6-AC3, F6-AC6, F6-AC7]
- **Files**: `src/pages/ReportPage.tsx`
- **Depends on**: Task 3.1, Task 2.8

### Task 4.12 리포트 본문 — 배분 Card · 진단 Card · AdSlot
- **Description**: `div data-testid="report-body"` 안에 `Card data-testid="allocation-card"`(4개 카테고리 `MiniBar` + 비중 % + 총자산 t3)와 `Card data-testid="diagnosis-card"`(`diagnose()` 결과 `ListRow` 1~3행 + 부채비율 t3 강조 + `Chip` 배지)를 렌더하고, 본문 아래 `AdSlot` 1개를 배치한다. 계산 중 프레임은 Skeleton Card 2개.
- **DoD**:
  - 공개 상태에서 `data-testid="report-body"` 내부에 `allocation-card` 1개, `diagnosis-card` 1개가 존재하고 MiniBar 4행.
  - F6-AC5 데이터 → 진단 `ListRow` 3행이 `R_DEBT_HIGH → R_RE_HEAVY → R_CASH_LOW` 순서로 SPEC 문구와 정확히 일치하며 `R_BALANCED` 문구 미표시, 부채비율 `63.5%`가 t3 + 배지로 표시.
  - 진단 `ListRow`에 onClick/onPress 핸들러 0건(비인터랙티브).
  - 계산 진행 프레임에 Skeleton Card 2개 표시 → 완료 후 300ms 이내 실제 Card로 교체.
  - `<AdSlot />`이 본문 아래 1회만 렌더(리포트 화면 총 배너 1개).
- **Covers**: [F6-AC4, F6-AC5(표시), F6-AC8]
- **Files**: `src/pages/report/ReportBody.tsx`, `src/pages/ReportPage.tsx`
- **Depends on**: Task 4.11

### Task 4.13 뱃지 목록 화면 — `/badges`
- **Description**: `Top`(뒤로가기 44×44px + "마일스톤") > `Card data-testid="badge-summary"`("8개 중 3개" t3) > 8행 고정 `ListRow`(획득: `data-testid="badge-earned"` + 획득일 `2026.09.10` 캡션 + `Chip`, 미획득: `data-testid="badge-locked"` + 남은 금액 "2억원 남음"). 진입 state는 `(useLocation().state as RouteState['/badges']) ?? null` → `s?.highlightBadgeId` 있으면 해당 행 강조 배경 1.5초. 가상 스크롤 미적용.
- **DoD**:
  - 8개 마일스톤 행이 항상 렌더되고 `badge-earned` + `badge-locked` 개수 합이 8.
  - 획득 행에 `2026.09.10` 형식 캡션, 미획득 행에 `formatCompactKRW` 기반 남은 금액 문구(`M_DEBT_FREE`는 "대출 0원 만들기").
  - 획득 0개 → 상단 `Asset.ContentIcon` + "첫 자산을 등록하면 첫 뱃지를 받아요", 8행 전부 `badge-locked`.
  - 로딩 프레임에 ListRow Skeleton 4개 표시, "남은 금액" 텍스트 0건.
  - 뱃지 행에 탭 핸들러 0건, 뒤로가기 버튼 탭 시 `navigate(-1)`.
  - **state 없이 `/badges` 직접 진입해도 크래시하지 않고 강조 없이 목록이 렌더된다.**
- **Covers**: [F7-AC3, F7-AC7, F7-AC8]
- **Files**: `src/pages/BadgesPage.tsx`
- **Depends on**: Task 3.1

---

## Epic 5. 통합 + 검수

**Risk Assessment**
- **Complexity**: Medium
- **Risk factors**: (1) 라우터 배선이 마지막이라 Provider 누락 시 전 페이지가 동시에 죽음. (2) 검수 항목(HEX·`window.open`·콘솔 에러·빌드 타깃)은 코드 전역에 흩어져 있어 마지막에 한 번에 잡지 않으면 재작업이 커짐. (3) 빌드 타깃 미설정 시 Android 7에서 백지 화면.
- **Mitigation**: 라우팅/404(5.1)와 정적 검수 스윕(5.2)을 분리해, 5.1 완료 시점에 앱이 실제로 걸어다닐 수 있고 5.2는 순회 검증만 수행한다. 앞선 모든 페이지 태스크의 공통 DoD에 HEX·콘솔 규칙을 미리 넣어 5.2에서 발견되는 위반을 최소화한다.

### Task 5.1 라우터 · FloatingTabBar · 404 폴백
- **Description**: `BrowserRouter` + `AppDataProvider`로 앱을 감싸고 라우트 8개(`/`, `/assets`, `/assets/new`, `/assets/:id/edit`, `/trend`, `/goal`, `/badges`, `/report`, `*`)를 배선한다. 템플릿 `FloatingTabBar`에 4개 탭(홈/자산/추이/리포트)을 연결하고, 폼 화면(`/assets/new`, `/assets/:id/edit`)과 404에서는 숨긴다. `*` 라우트에 404 페이지(`ScreenScaffold` 중앙 정렬 flex + `Asset.ContentIcon` + "페이지를 찾을 수 없어요" + `Button display="block"` "홈으로" 높이 52px → `navigate('/',{replace:true})`)를 구현한다. 전역 `ErrorBoundary`로 렌더 예외를 잡아 "데이터를 불러오지 못했어요" + "다시 시도" Card를 표시한다.
- **DoD**:
  - 앱 실행 시 하단에 `FloatingTabBar`가 4개 탭으로 렌더되고 각 탭 히트 영역 ≥ 44×44px.
  - `pathname`이 `/trend`일 때 "추이" 탭만 활성 스타일(활성 요소 수 === 1), 다른 3개는 비활성.
  - `/unknown-path` 진입 → "페이지를 찾을 수 없어요" + "홈으로" 버튼 표시, 탭 시 `/`로 replace 이동(history 길이 증가 없음).
  - 8개 라우트를 순회했을 때 전부 `ScreenScaffold`로 감싸여 렌더되고 white screen 0건.
  - ErrorBoundary가 자식 예외를 잡아 "다시 시도" 버튼을 노출하며 `console.error` 0건.
- **Covers**: [F8-AC1, F8-AC6]
- **Files**: `src/App.tsx`, `src/router.tsx`, `src/pages/NotFoundPage.tsx`, `src/components/AppErrorBoundary.tsx`
- **Depends on**: Task 4.1, Task 4.5, Task 4.7, Task 4.9, Task 4.11, Task 4.13

### Task 5.2 검수 컴플라이언스 스윕 (HEX · 외부이탈 · 콘솔 · 빌드 타깃)
- **Description**: 전 소스 정적 검사 + 빌드 설정 마감. `vite.config.ts`의 `build.target`을 `['chrome60','safari16']`(ES2018 하한)으로 고정하고, `src/**/*.{ts,tsx,css}`의 HEX 색상·`window.open`·외부 URL 대입·설치 유도 문구를 제거한다. `package.json`에서 analytics 계열 의존성 부재를 확인하고, 빌드 결과물로 홈→자산→추이→리포트→목표→뱃지 순회 스모크 검증을 수행한다.
- **DoD**:
  - `grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.ts' --include='*.tsx' --include='*.css'` 매칭 0건.
  - `grep -rn 'window.open' src` 0건, `window.location.href =` 에 외부 URL(`http(s)://` + 비자체 도메인) 대입 0건.
  - UI 텍스트에 "설치"/"다운로드"/"앱스토어"/"구글플레이" 0건.
  - `grep -rnE '\.at\(|Object\.groupBy|structuredClone|\(\?<' src` 0건이고 `dist` 번들에도 동일 매칭 0건.
  - `npm ls` 결과에 `analytics`/`amplitude`/`ga`/`gtag` 관련 패키지 0개, 앱 실행 중 토스 SDK·광고 SDK 외 도메인 네트워크 요청 0건.
  - `vite build` 산출물 실행 후 홈→자산→추이→리포트→목표→뱃지 순회 시 `console.error` 0건, React key 경고 0건, 미처리 Promise rejection 0건.
  - 다크모드 토글 시 6개 화면 모두 텍스트/배경 대비가 유지되고 판독 불가 요소 0건.
- **Covers**: [F8-AC2, F8-AC3, F8-AC4, F8-AC5, F8-AC8]
- **Files**: `vite.config.ts`, `package.json`, `src/**/*.{ts,tsx,css}`(위반 지점 수정)
- **Depends on**: Task 5.1

---

## AC Coverage

- **Total ACs in SPEC**: 64 (F1~F8 × 8)
- **Covered by tasks**: 64

| Feature | AC → Task |
|---|---|
| F1 | AC1→2.2, AC2→2.3, AC3→2.2, AC4→2.1, AC5→2.1+2.2, AC6→2.2, AC7→2.3, AC8→2.2 |
| F2 | AC1→4.3, AC2→4.4, AC3→4.2, AC4→4.3, AC5→4.3, AC6→4.1, AC7→4.3, AC8→4.1 |
| F3 | AC1→4.5, AC2→4.5, AC3→2.7+4.6, AC4→2.7+4.6, AC5→4.5, AC6→4.5, AC7→4.6, AC8→4.6 |
| F4 | AC1→2.4+3.1, AC2→4.7, AC3→4.8, AC4→4.7, AC5→4.7, AC6→4.7, AC7→4.7+4.8, AC8→4.8 |
| F5 | AC1→2.5+4.9, AC2→4.10, AC3→2.5+4.10, AC4→4.10, AC5→2.5+4.9, AC6→2.5+4.9, AC7→2.5+4.10, AC8→2.5+4.10 |
| F6 | AC1→2.7+4.11, AC2→4.11, AC3→2.7+4.11, AC4→4.12, AC5→2.8+4.12, AC6→4.11, AC7→4.11, AC8→4.12 |
| F7 | AC1→2.6, AC2→3.1+4.6, AC3→4.13, AC4→2.6, AC5→2.6, AC6→2.6, AC7→4.13, AC8→4.13 |
| F8 | AC1→5.1, AC2→5.2, AC3→5.2, AC4→5.2, AC5→2.1+5.2, AC6→5.1, AC7→4.4, AC8→5.2 |

- **Uncovered**: 0

**참고**: Task 1.1(타입/상수)과 Task 3.1(상태관리)은 기반 태스크로, 1.1은 직접 커버하는 AC가 없으나 나머지 24개 태스크 전부가 의존한다. 3.1은 F4-AC1·F7-AC2의 배선 절반을 담당하며 각 AC의 최종 검증은 표기된 UI 태스크에서 이뤄진다.