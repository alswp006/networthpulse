# SPEC — NetWorthPulse

> Source: PRD `NetWorthPulse` (앱인토스 / Vite + React + TypeScript + TDS)
> 이 문서는 PRD를 구현 가능한 수준으로 확장한 것이며, PRD에 없는 사실은 `Assumptions`에 명시했다.

---

## Common Principles

| 항목 | 규정 |
|---|---|
| 플랫폼 | 앱인토스 웹뷰 (모바일 전용). 데스크톱 레이아웃 미지원 |
| 인증 | 토스 앱이 세션을 자동 제공. 로그인 화면·로그인 호출 없음. 유저 식별 필요 시 `getIsTossLoginIntegratedService()`로 연동 여부만 확인 |
| UI 라이브러리 | `@toss/tds-mobile` 단독. shadcn/ui, MUI, Ant Design, Chakra UI 사용 금지 |
| 간격 | TDS `Spacing`(size prop 필수)만 사용. TDS 컴포넌트에 Tailwind/인라인 margin·padding 덮어쓰기 금지 |
| 커스텀 CSS | TDS가 제공하지 않는 flex/grid 배치, SVG 차트 렌더링에만 허용 |
| 색상 | `var(--tds-color-*)` CSS 변수 또는 TDS 컴포넌트 기본값만 사용. HEX 하드코딩 금지(다크모드 필수) |
| 페이지 골격 | 모든 라우트는 템플릿 제공 `ScreenScaffold`로 감싼다. raw `<div>` 골격 금지 |
| 1차 액션 | `SubmitFooter`(하단 고정) 또는 TDS Button `display="block"`. 좌측 글자폭 버튼 금지 |
| 터치 타깃 | 모든 인터랙티브 요소 최소 44×44px |
| 라우팅 | `react-router-dom` (BrowserRouter). 하단 네비는 템플릿 `FloatingTabBar` (TDS에 TabBar 없음) |
| 저장소 | localStorage 단독. 서버·외부 API 없음 |
| 통화 단위 | 원(KRW) 정수. 소수점·외화 미지원 |
| 금액 표기 | `Intl.NumberFormat('ko-KR')` 3자리 콤마. 1억 이상은 요약 화면에서 `1억 2,340만원` 형식 축약 |
| 광고 | 배너 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`, 리워드 게이트 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` — 템플릿 컴포넌트 그대로 사용, 재구현 금지 |
| 결제 | 없음(수익모델 = 광고 전용). `TossPurchase` 미사용 |
| 외부 분석 도구 | Google Analytics/Amplitude 등 사용 금지 |
| AI | 본 앱은 생성형 AI를 사용하지 않는다(리포트는 결정론적 룰 기반 계산). 따라서 AI 고지 의무 대상이 아니며, "AI가 생성한 결과입니다" 라벨을 표시하지 않는다 (Assumptions A7 참조) |
| 알림 | 푸시 알림 미사용. "주간 체크인"은 인앱 홈 배너로만 구현 |

### 공통 타입

```ts
export type AssetCategory = 'deposit' | 'stock' | 'realestate' | 'loan';

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  deposit: '예금',
  stock: '주식',
  realestate: '부동산',
  loan: '대출',
};

/** 부채로 취급되는 카테고리 */
export const LIABILITY_CATEGORIES: AssetCategory[] = ['loan'];

export const AMOUNT_MIN = 1;                  // 원
export const AMOUNT_MAX = 999_999_999_999;    // 999,999,999,999원 (1조 미만)
export const ASSET_MAX_COUNT = 200;
export const SNAPSHOT_MAX_COUNT = 60;         // 최근 60개월
```

---

## Data Models

### Asset — 자산/부채 항목

```ts
export interface Asset {
  id: string;            // crypto.randomUUID()
  name: string;          // 1~20자, trim 후 공백 불가
  category: AssetCategory;
  amount: number;        // 정수, 1 ~ 999_999_999_999 (loan도 양수로 저장)
  memo: string;          // 0~50자, 미입력 시 ''
  createdAt: string;     // ISO8601
  updatedAt: string;     // ISO8601
}
```

- key: `nwp:assets:v1`
- shape: `Asset[]`
- 제약: 최대 200건. 동일 `name` + `category` 조합 중복 허용(경고 없음).
- 크기: 1건 ≈ 220 bytes → 200건 ≈ 44KB

### NetWorthSnapshot — 월별 순자산 스냅샷

```ts
export interface NetWorthSnapshot {
  month: string;                            // 'YYYY-MM' (PK, 유니크)
  totalAssets: number;                      // deposit+stock+realestate 합
  totalLiabilities: number;                 // loan 합
  netWorth: number;                         // totalAssets - totalLiabilities
  byCategory: Record<AssetCategory, number>;
  capturedAt: string;                       // ISO8601 (마지막 갱신 시각)
}
```

- key: `nwp:snapshots:v1`
- shape: `NetWorthSnapshot[]` — `month` 오름차순 정렬 유지
- 제약: 같은 달 재계산 시 기존 레코드 덮어쓰기(upsert). 60건 초과 시 가장 오래된 달부터 제거
- 크기: 1건 ≈ 190 bytes → 60건 ≈ 12KB

### Goal — 목표 순자산

```ts
export interface Goal {
  targetAmount: number;   // 정수, 1 ~ 999_999_999_999
  targetDate: string;     // 'YYYY-MM-DD', 오늘 이후
  createdAt: string;      // ISO8601
  updatedAt: string;      // ISO8601
}
```

- key: `nwp:goal:v1`
- shape: `Goal | null` (미설정 시 키 없음)
- 크기: ≈ 140 bytes

### Badge — 마일스톤 뱃지

```ts
export type MilestoneId =
  | 'M_FIRST_RECORD' | 'M_10M' | 'M_50M' | 'M_100M'
  | 'M_300M' | 'M_500M' | 'M_1B' | 'M_DEBT_FREE';

export interface Badge {
  id: MilestoneId;
  achievedAt: string;   // ISO8601
  netWorthAt: number;   // 달성 시점 순자산
}
```

- key: `nwp:badges:v1`
- shape: `Badge[]`
- 마일스톤 임계값(순자산 기준):
  | id | 조건 | 라벨 |
  |---|---|---|
  | `M_FIRST_RECORD` | 자산 항목 1건 이상 저장 | 첫 기록 |
  | `M_10M` | netWorth ≥ 10,000,000 | 1천만원 |
  | `M_50M` | netWorth ≥ 50,000,000 | 5천만원 |
  | `M_100M` | netWorth ≥ 100,000,000 | 1억원 |
  | `M_300M` | netWorth ≥ 300,000,000 | 3억원 |
  | `M_500M` | netWorth ≥ 500,000,000 | 5억원 |
  | `M_1B` | netWorth ≥ 1,000,000,000 | 10억원 |
  | `M_DEBT_FREE` | 자산 1건 이상 && totalLiabilities === 0 | 무부채 |
- 뱃지는 한 번 획득하면 순자산이 내려가도 회수하지 않는다.
- 크기: 8건 × 90 bytes ≈ 0.8KB

### AppMeta — 앱 상태 플래그

```ts
export interface AppMeta {
  lastCheckInAt: string | null;      // ISO8601, 마지막 자산 갱신/체크인 시각
  reportUnlockedMonth: string | null;// 'YYYY-MM', 리워드 광고로 리포트를 연 달
  schemaVersion: 1;
}
```

- key: `nwp:meta:v1`
- shape: `AppMeta`
- 크기: ≈ 120 bytes

### 총 저장 용량

44KB + 12KB + 0.2KB + 0.8KB + 0.2KB ≈ **58KB** (localStorage 5MB 한도의 약 1.2%)

### 파생 계산 (저장하지 않음)

```ts
export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byCategory: Record<AssetCategory, number>;
  categoryRatio: Record<AssetCategory, number>; // 0~100, 소수 1자리 반올림, 총자산 기준
  debtRatio: number;                            // totalLiabilities / totalAssets * 100, 총자산 0이면 0
  momDelta: number | null;                      // 전월 스냅샷 대비 증감액, 전월 없으면 null
}
```

---

## Feature List

### F1. 자산 데이터 레이어 (스토리지 & 순자산 계산)

- **Description**: `Asset` CRUD와 순자산 집계를 담당하는 순수 TypeScript 레이어를 구현한다. localStorage 읽기/쓰기, JSON 파싱 실패 복구, 용량 초과 처리, 순자산·카테고리 비중 계산 함수를 제공하며 UI 의존성이 없다. 이후 모든 화면은 이 레이어만 통해 데이터를 읽고 쓴다.
- **Data**: `Asset`, `NetWorthSummary` (`nwp:assets:v1`)
- **API**: 없음 (외부 호출 없음)
- **Requirements**: `listAssets()`, `createAsset(input)`, `updateAsset(id, input)`, `deleteAsset(id)`, `computeSummary(assets)` 를 export한다.

- **AC-1 [E][P0]: Scenario: 자산 생성 성공**
  Given `nwp:assets:v1`가 빈 배열일 때
  When `createAsset({ name: "국민은행 예금", category: "deposit", amount: 12000000, memo: "비상금" })` 호출
  Then 반환된 `Asset.id`는 빈 문자열이 아니고 `createdAt === updatedAt`이며
  And `localStorage.getItem('nwp:assets:v1')`를 파싱하면 길이 1의 배열이고 `amount === 12000000`이다

- **AC-2 [U][P0]: Scenario: 순자산 집계**
  Given assets = `[{category:'deposit',amount:12000000},{category:'stock',amount:8000000},{category:'realestate',amount:300000000},{category:'loan',amount:120000000}]`
  When `computeSummary(assets)` 호출
  Then `totalAssets === 320000000`, `totalLiabilities === 120000000`, `netWorth === 200000000`
  And `categoryRatio.realestate === 93.8`, `debtRatio === 37.5`

- **AC-3 [E][P0]: Scenario: 수정과 삭제**
  Given `id === "a1"`인 자산이 `amount: 5000000`으로 저장돼 있을 때
  When `updateAsset("a1", { amount: 7000000 })` 후 `deleteAsset("a1")` 호출
  Then 수정 직후 `updatedAt !== createdAt`이고, 삭제 후 `listAssets()`는 길이 0의 배열을 반환한다

- **AC-4 [W][P1]: Scenario: 손상된 JSON 복구**
  Given `localStorage.setItem('nwp:assets:v1', '{broken')` 인 상태일 때
  When `listAssets()` 호출
  Then 예외를 던지지 않고 빈 배열 `[]`을 반환하고
  And `console.error`를 호출하지 않으며 해당 키를 빈 배열 `[]`로 재초기화한다

- **AC-5 [W][P1]: Scenario: localStorage 용량 초과**
  Given `setItem`이 `QuotaExceededError`를 던지는 상태일 때
  When `createAsset({ name:"테스트", category:"deposit", amount:1000, memo:"" })` 호출
  Then `{ ok: false, error: "저장 공간이 부족해요. 오래된 항목을 삭제해주세요" }`를 반환하고
  And 기존 저장 데이터는 변경되지 않는다

- **AC-6 [W][P1]: Scenario: 항목 수 상한 초과**
  Given 저장된 자산이 200건일 때
  When `createAsset(...)` 호출
  Then `{ ok: false, error: "자산은 최대 200개까지 등록할 수 있어요" }`를 반환하고 배열 길이는 200으로 유지된다

- **AC-7 [S][P1]: Scenario: 빈 데이터 상태**
  While `nwp:assets:v1` 키가 존재하지 않을 때
  When `computeSummary(listAssets())` 호출
  Then `netWorth === 0`, `debtRatio === 0`, `momDelta === null`, 모든 `categoryRatio` 값이 `0`이다

- **AC-8 [W][P1]: Scenario: 유효하지 않은 입력 거부**
  Given 빈 저장소일 때
  When `createAsset({ name:"  ", category:"deposit", amount:0, memo:"" })` 호출
  Then `{ ok: false, error: "이름과 금액을 확인해주세요" }`를 반환하고 저장이 발생하지 않는다

---

### F2. 자산 목록 & 입력 폼 UI

- **Description**: 자산·부채를 카테고리별로 조회·추가·수정·삭제하는 화면을 구현한다. 목록은 TDS `ListRow`로 카테고리 섹션 그룹핑되어 표시되고, 입력은 TDS `TextField`와 카테고리 `Chip` 선택으로 구성된 폼 화면에서 처리한다. 모든 쓰기 작업은 F1 레이어를 호출하고 결과를 TDS `Toast`로 알린다.
- **Data**: `Asset`
- **API**: 없음
- **Requirements**: 라우트 `/assets`, `/assets/new`, `/assets/:id/edit`

- **AC-1 [E][P0]: Scenario: 자산 추가 성공**
  Given `/assets/new` 화면에서 토스 세션 유저가 있을 때
  When 카테고리 Chip "주식" 선택 후 `{ name: "삼성전자", amount: 8500000, memo: "장기보유" }` 입력하고 SubmitFooter의 "저장" 버튼 탭
  Then `nwp:assets:v1`에 항목이 추가되고 TDS Toast에 "저장했어요"가 표시되며
  And `/assets`로 navigate되어 목록 최상단 "주식" 섹션에 `삼성전자 · 8,500,000원` 행이 보인다

- **AC-2 [E][P0]: Scenario: 자산 수정**
  Given `/assets/:id/edit` 진입 시 폼에 기존 값 `{ name:"삼성전자", amount:8500000 }`이 프리필된 상태일 때
  When amount를 `9200000`으로 바꾸고 "저장" 탭
  Then 해당 항목의 `amount === 9200000`, `updatedAt`이 갱신되고 Toast "수정했어요"가 표시된다

- **AC-3 [E][P0]: Scenario: 삭제 확인 다이얼로그**
  Given `/assets` 목록에서 항목 행을 길게 누르지 않고 행 우측 "삭제" 버튼(44×44px)을 탭했을 때
  When TDS AlertDialog "삭제할까요?"에서 "삭제" 버튼 탭
  Then 항목이 저장소에서 제거되고 Toast "삭제했어요"가 표시되며, "취소" 탭 시 아무 변경도 일어나지 않는다

- **AC-4 [W][P1]: Scenario: 금액 0 입력 거부**
  Given `/assets/new`에서 카테고리 "예금" 선택 상태일 때
  When `{ name: "적금", amount: 0, memo: "" }` 입력 후 "저장" 탭
  Then TextField 하단에 "금액을 1원 이상 입력해주세요"가 표시되고 저장되지 않으며 화면 이동이 없다

- **AC-5 [W][P1]: Scenario: 이름 길이 초과 및 상한 금액**
  Given `/assets/new` 화면일 때
  When name에 21자를 입력하면 21번째 글자가 입력되지 않고 "이름은 20자까지 입력할 수 있어요"가 표시되며
  And amount에 `1000000000000`을 입력하고 "저장" 탭 시 "금액은 999,999,999,999원까지 입력할 수 있어요"가 표시된다

- **AC-6 [S][P1]: Scenario: 빈 목록 상태**
  While `listAssets()` 결과가 길이 0일 때
  Then `/assets`에는 TDS `Asset.ContentIcon`과 "아직 등록한 자산이 없어요" 문구, `display="block"` "자산 추가하기" 버튼이 표시되고 삭제/수정 버튼은 렌더링되지 않는다

- **AC-7 [U][P0]: Scenario: 모바일 키보드 대응**
  Given `/assets/new`의 amount TextField가 포커스됐을 때
  Then `inputMode="numeric"` 숫자 키패드가 열리고, SubmitFooter 저장 버튼이 키보드에 가려지지 않도록 `env(safe-area-inset-bottom)` 기준 하단 고정을 유지하며
  And 입력값은 3자리 콤마로 실시간 포맷되고 저장 시 콤마를 제거한 정수로 변환된다

- **AC-8 [U][P1]: Scenario: 목록 스크롤 성능**
  Given 자산이 200건 저장된 상태일 때
  Then `/assets` 목록은 `react-window` 기반 가상 스크롤(항목 높이 72px, overscan 5)로 렌더링되고, 동시에 DOM에 존재하는 ListRow는 30개 이하다

---

### F3. 홈 대시보드 (순자산 요약 + 주간 체크인 배너)

- **Description**: 앱 진입 시 현재 순자산, 전월 대비 증감, 카테고리 비중을 한 화면에 요약한다. 마지막 갱신일이 7일 이상 지나면 상단에 주간 체크인 배너를 노출해 자산 업데이트를 유도한다. 화면 하단(FloatingTabBar 위)에 배너 광고 슬롯을 배치한다.
- **Data**: `Asset`, `NetWorthSnapshot`, `AppMeta`
- **API**: 없음
- **Requirements**: 라우트 `/`

- **AC-1 [U][P0]: Scenario: 홈 레이아웃 계약**
  Given 자산이 1건 이상 저장된 상태로 `/`에 진입했을 때
  Then 화면은 `ScreenScaffold`로 감싸이고
  And `data-testid="networth-hero"` 인 `SummaryHero`가 순자산을 CountUp(0 → 값, 800ms)으로 t2 강조 타이포로 표시하며
  And `data-testid="category-breakdown"` Card 안에 4개 카테고리의 `MiniBar`(예금/주식/부동산/대출)가 비중과 함께 표시된다

- **AC-2 [E][P0]: Scenario: 전월 대비 증감 표시**
  Given 전월 스냅샷 `netWorth === 180000000`, 현재 순자산 `200000000`일 때
  When `/`가 렌더링되면
  Then hero 하단에 `+20,000,000원 (+11.1%)` 텍스트와 상승 배지가 표시되고, 감소 시 `-` 부호와 하락 배지가 표시된다

- **AC-3 [E][P1]: Scenario: 주간 체크인 배너 노출**
  Given `AppMeta.lastCheckInAt`가 오늘로부터 7일 이상 이전(예: `2026-09-01`, 오늘 `2026-09-10`)일 때
  When `/`에 진입하면
  Then `data-testid="checkin-banner"` Card에 "7일 동안 자산을 업데이트하지 않았어요" 문구와 "지금 업데이트" 버튼(높이 48px)이 표시되고
  And 버튼 탭 시 `navigate('/assets')` 되며 `lastCheckInAt`이 현재 시각으로 갱신된다

- **AC-4 [S][P1]: Scenario: 체크인 배너 미노출**
  While `lastCheckInAt`이 오늘로부터 7일 미만일 때
  Then `data-testid="checkin-banner"` 요소는 DOM에 존재하지 않는다

- **AC-5 [S][P1]: Scenario: 빈 상태**
  While 저장된 자산이 0건일 때
  Then hero 대신 `Asset.ContentIcon`과 "첫 자산을 등록하고 순자산을 확인해보세요" 문구, `display="block"` "자산 추가하기" 버튼이 표시되고 MiniBar 섹션은 렌더링되지 않는다

- **AC-6 [S][P1]: Scenario: 로딩 상태**
  While localStorage 읽기가 완료되지 않은 초기 렌더 프레임 동안
  Then hero 영역에 TDS Skeleton(높이 96px) 1개와 리스트 Skeleton 3개가 표시되고, 숫자 `0원`이 잠깐 노출되지 않는다

- **AC-7 [U][P0]: Scenario: 홈 배너 광고 배치**
  Given `/`가 렌더링됐을 때
  Then `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 카테고리 Card 아래·FloatingTabBar 위 독립 블록으로 1회만 렌더링되고
  And 광고 영역이 hero/Card/FloatingTabBar 어느 요소와도 겹치지 않는다(광고 컨테이너 `position: static`)

- **AC-8 [W][P1]: Scenario: 광고 로드 실패**
  Given AdSlot 내부 광고 로드가 실패했을 때
  Then 광고 영역 높이가 0으로 축소되어 빈 회색 박스가 남지 않고, 화면의 다른 콘텐츠는 정상 표시되며 `console.error` 출력이 없다

---

### F4. 월간 스냅샷 & 순자산 추이 차트

- **Description**: 현재 자산 합계를 `YYYY-MM` 단위 스냅샷으로 upsert하고, 최근 12개월 순자산 추이를 라인 차트로 보여준다. 차트는 TDS가 제공하지 않으므로 커스텀 SVG로 그리되 색상은 `var(--tds-color-*)` 변수만 사용한다. 월별 증감 내역은 차트 아래 ListRow 목록으로 제공한다.
- **Data**: `NetWorthSnapshot`, `Asset`
- **API**: 없음
- **Requirements**: 라우트 `/trend`. 스냅샷은 자산 생성/수정/삭제 성공 직후와 앱 진입 시 자동 upsert.

- **AC-1 [E][P0]: Scenario: 스냅샷 upsert**
  Given 오늘이 `2026-09-10`이고 `nwp:snapshots:v1`에 `2026-09` 레코드가 없을 때
  When 자산 저장이 성공하면
  Then `{ month: "2026-09", netWorth: <계산값>, capturedAt: <현재시각> }` 레코드가 추가되고
  And 같은 달에 다시 저장하면 레코드 수는 늘지 않고 `netWorth`와 `capturedAt`만 갱신된다

- **AC-2 [U][P0]: Scenario: 추이 화면 레이아웃 계약**
  Given 스냅샷이 3개 이상 존재할 때
  When `/trend`에 진입하면
  Then `ScreenScaffold` 안에 `data-testid="trend-chart-card"` Card가 존재하고 그 안에 SVG 라인 차트(`data-testid="trend-line-chart"`)의 `<polyline>` 좌표 개수가 스냅샷 개수와 같으며
  And 차트 상단에 최신 순자산이 t3 강조 타이포로 표시된다

- **AC-3 [E][P0]: Scenario: 기간 필터**
  Given `/trend`에서 TDS Tab이 `3개월 / 6개월 / 12개월`로 표시될 때
  When "6개월" 탭을 탭하면
  Then 차트는 최근 6개 스냅샷만 그리고, 데이터가 4개뿐이면 4개 점만 그린 뒤 "데이터 4개월치" 캡션을 표시한다

- **AC-4 [S][P1]: Scenario: 데이터 1개 이하 빈 상태**
  While 스냅샷이 0개 또는 1개일 때
  Then 차트 대신 `Asset.ContentIcon`과 "2개월 이상 기록하면 추이를 볼 수 있어요" 문구가 표시되고 `data-testid="trend-line-chart"`는 DOM에 없다

- **AC-5 [S][P1]: Scenario: 로딩 상태**
  While 스냅샷 로드 전 초기 프레임 동안
  Then 차트 자리에 높이 200px TDS Skeleton이 표시되고 축 라벨은 렌더링되지 않는다

- **AC-6 [W][P1]: Scenario: 동일 값 구간 처리**
  Given 12개 스냅샷의 `netWorth`가 모두 `100000000`으로 동일할 때
  When 차트를 렌더링하면
  Then Y축 max-min이 0이 되어 NaN 좌표가 생기지 않고, 라인이 차트 영역 세로 중앙(y = height/2)에 수평선으로 그려진다

- **AC-7 [W][P1]: Scenario: 음수 순자산 표시**
  Given 스냅샷에 `netWorth: -35000000`이 포함될 때
  Then Y축 하한이 음수까지 확장되고 0 기준선이 점선으로 표시되며, 목록 행에 `-35,000,000원`이 표시된다

- **AC-8 [U][P0]: Scenario: 추이 화면 광고**
  Given `/trend`가 렌더링됐을 때
  Then `<AdSlot />`이 차트 Card와 월별 목록 사이에 1회 렌더링되고 차트/목록과 겹치지 않는다

---

### F5. 목표 순자산 설정 & 달성률 게이지

- **Description**: 목표 순자산 금액과 목표 날짜를 설정하고, 현재 순자산 대비 달성률을 게이지와 퍼센트로 시각화한다. 목표까지 남은 금액과 남은 개월 수, 월 평균 필요 저축액을 계산해 표시한다. 목표는 1개만 유지하며 재설정 시 덮어쓴다.
- **Data**: `Goal`, `Asset`
- **API**: 없음
- **Requirements**: 라우트 `/goal`

- **AC-1 [E][P0]: Scenario: 목표 설정 성공**
  Given `/goal` 진입 시 목표가 미설정 상태일 때
  When `{ targetAmount: 500000000, targetDate: "2030-12-31" }` 입력 후 SubmitFooter "목표 저장" 탭
  Then `nwp:goal:v1`에 저장되고 Toast "목표를 저장했어요"가 표시되며 게이지 화면으로 전환된다

- **AC-2 [U][P0]: Scenario: 달성률 계산과 레이아웃 계약**
  Given `Goal.targetAmount === 500000000`, 현재 `netWorth === 200000000`일 때
  When `/goal`이 렌더링되면
  Then `data-testid="goal-gauge-card"` Card 안에 달성률 `40.0%`가 t2 강조 타이포로 표시되고
  And 게이지 진행 바의 `aria-valuenow === 40`이며 "남은 금액 300,000,000원" 텍스트가 함께 표시된다

- **AC-3 [E][P0]: Scenario: 월 필요 저축액**
  Given 오늘 `2026-09-10`, `targetDate === "2028-09-30"`, 남은 금액 `300000000`일 때
  Then "매월 12,500,000원씩 모으면 달성" 문구가 표시된다(남은 개월 24개월, 원 단위 내림)

- **AC-4 [S][P1]: Scenario: 목표 미설정 빈 상태**
  While `nwp:goal:v1`이 없을 때
  Then 게이지 대신 `Asset.ContentIcon`과 "목표를 정하면 달성률을 볼 수 있어요" 문구, `display="block"` "목표 설정하기" 버튼이 표시된다

- **AC-5 [W][P1]: Scenario: 과거 날짜 거부**
  Given 오늘이 `2026-09-10`일 때
  When `targetDate`에 `2026-09-09`를 입력하고 저장 탭
  Then "목표 날짜는 오늘 이후로 정해주세요"가 표시되고 저장되지 않는다

- **AC-6 [W][P1]: Scenario: 목표 금액 유효성**
  When `targetAmount`에 `0`을 입력하고 저장 탭
  Then "목표 금액을 1원 이상 입력해주세요"가 표시되고
  And `1000000000000` 입력 시 "목표 금액은 999,999,999,999원까지 입력할 수 있어요"가 표시된다

- **AC-7 [S][P1]: Scenario: 목표 초과 달성**
  While `netWorth (600000000) >= targetAmount (500000000)` 일 때
  Then 달성률은 `100.0%`로 상한 처리되고 "목표를 달성했어요" 배지가 게이지 상단에 표시되며 "남은 금액" 문구 대신 "초과 100,000,000원"이 표시된다

- **AC-8 [W][P1]: Scenario: 순자산 음수일 때 게이지**
  Given `netWorth === -10000000`, `targetAmount === 500000000`일 때
  Then 달성률은 `0.0%`(하한 처리)로 표시되고 게이지 진행 바 width는 0%이며 NaN이 화면에 출력되지 않는다

---

### F6. 자산배분 분석 리포트 (리워드 광고 게이팅)

- **Description**: 카테고리 비중, 부채비율, 현금성 자산 비중을 결정론적 룰로 진단해 리포트를 생성한다. 리포트 본문은 `TossRewardAd`로 게이팅되어 광고 시청 완료 후 공개되며, 해제 상태는 해당 월 동안 유지된다. 진단 문구는 사전에 정의된 룰 테이블에서 선택되며 생성형 AI를 사용하지 않는다.
- **Data**: `Asset`, `NetWorthSummary`, `AppMeta.reportUnlockedMonth`
- **API**: 없음
- **Requirements**: 라우트 `/report`

**진단 룰 테이블(결정론적)**

| 룰 ID | 조건 | 진단 문구 |
|---|---|---|
| `R_DEBT_HIGH` | `debtRatio >= 60` | "총자산 대비 부채가 60% 이상이에요. 부채 상환을 우선 검토해보세요" |
| `R_DEBT_OK` | `debtRatio < 30` | "부채비율이 30% 미만으로 안정적이에요" |
| `R_RE_HEAVY` | `categoryRatio.realestate >= 70` | "부동산 비중이 70% 이상이에요. 현금화가 어려울 수 있어요" |
| `R_CASH_LOW` | `categoryRatio.deposit < 10` | "현금성 자산이 10% 미만이에요. 비상금 확보를 검토해보세요" |
| `R_STOCK_HEAVY` | `categoryRatio.stock >= 60` | "주식 비중이 60% 이상이에요. 변동성이 클 수 있어요" |
| `R_BALANCED` | 위 조건 모두 불일치 | "자산배분이 특정 항목에 치우치지 않았어요" |

- **AC-1 [E][P0]: Scenario: 리워드 광고 시청 후 리포트 공개**
  Given `/report`에서 `AppMeta.reportUnlockedMonth !== "2026-09"`(현재 월)이고 자산이 1건 이상일 때
  When "리포트 보기" 버튼 탭 → `TossRewardAd` 광고 시청이 완료되면
  Then `data-testid="report-body"` 영역이 표시되고 `reportUnlockedMonth`가 `"2026-09"`로 저장된다

- **AC-2 [S][P0]: Scenario: 게이팅 상태 화면**
  While `reportUnlockedMonth !== 현재 월` 일 때
  Then `data-testid="report-body"`는 DOM에 존재하지 않고, 잠금 안내 Card("광고를 보면 이번 달 리포트가 열려요")와 `display="block"` "리포트 보기" 버튼(높이 48px)만 표시된다

- **AC-3 [S][P0]: Scenario: 같은 달 재진입 시 광고 생략**
  While `reportUnlockedMonth === "2026-09"` 이고 오늘이 `2026-09-20`일 때
  When `/report`에 진입하면
  Then 광고 없이 즉시 `data-testid="report-body"`가 표시된다

- **AC-4 [U][P0]: Scenario: 리포트 본문 레이아웃 계약**
  Given 리포트가 공개된 상태일 때
  Then `data-testid="report-body"` 안에 `data-testid="allocation-card"` Card 1개(4개 카테고리 `MiniBar` + 비중 %)와 `data-testid="diagnosis-card"` Card 1개(룰 진단 문구 ListRow 목록)가 존재하고
  And 부채비율 값이 t3 강조 타이포와 배지로 표시된다

- **AC-5 [E][P0]: Scenario: 룰 판정 결과**
  Given `{ deposit: 5000000, stock: 10000000, realestate: 300000000, loan: 200000000 }` 일 때
  Then `debtRatio === 63.5`이고 진단 목록에 `R_DEBT_HIGH`, `R_RE_HEAVY`, `R_CASH_LOW` 문구 3개가 이 순서로 표시되며 `R_BALANCED`는 표시되지 않는다

- **AC-6 [W][P1]: Scenario: 광고 로드/시청 실패**
  Given "리포트 보기" 탭 후 `TossRewardAd`가 실패 또는 중도 종료를 반환했을 때
  Then Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"가 표시되고
  And `reportUnlockedMonth`는 갱신되지 않으며 리포트 본문은 표시되지 않고 `console.error` 출력이 없다

- **AC-7 [S][P1]: Scenario: 자산 없음 빈 상태**
  While 저장된 자산이 0건일 때
  Then `/report`는 "리포트 보기" 버튼 대신 `Asset.ContentIcon`과 "자산을 1개 이상 등록하면 리포트를 만들 수 있어요" 문구를 표시하고 광고를 로드하지 않는다

- **AC-8 [S][P1]: Scenario: 리포트 계산 로딩**
  While 광고 시청 완료 후 리포트 계산이 끝나기 전 프레임 동안
  Then 본문 자리에 TDS Skeleton Card 2개가 표시되고, 계산 완료 후 300ms 이내에 실제 Card로 교체된다

---

### F7. 마일스톤 뱃지

- **Description**: 순자산이 사전에 정의된 임계값을 넘거나 무부채 상태가 되면 뱃지를 자동 부여하고 획득 시점을 기록한다. 뱃지 획득은 자산 저장/수정/삭제 직후 평가되며, 새로 획득 시 홈에서 축하 BottomSheet를 1회 노출한다. 뱃지 목록 화면에서 획득/미획득 상태를 함께 보여준다.
- **Data**: `Badge`, `Asset`
- **API**: 없음
- **Requirements**: 라우트 `/badges`. 평가 함수 `evaluateBadges(summary, assetCount, owned): Badge[]`

- **AC-1 [E][P0]: Scenario: 뱃지 신규 획득**
  Given 보유 뱃지가 `['M_FIRST_RECORD']`이고 자산 저장 후 `netWorth === 105000000`일 때
  When `evaluateBadges()`가 실행되면
  Then `M_10M`, `M_50M`, `M_100M` 3개가 `achievedAt` 현재 시각으로 추가 저장되어 총 4개가 된다

- **AC-2 [E][P0]: Scenario: 축하 BottomSheet**
  Given 직전 저장으로 `M_100M`이 신규 획득됐을 때
  When 저장 후 화면이 렌더링되면
  Then TDS BottomSheet가 1회 열려 "1억원 달성!" 문구와 "확인" 버튼(높이 48px)이 표시되고
  And 확인 탭 후 앱을 재진입해도 같은 뱃지로 BottomSheet가 다시 열리지 않는다

- **AC-3 [U][P0]: Scenario: 뱃지 목록 화면**
  Given `/badges`에 진입했을 때
  Then 8개 마일스톤이 모두 ListRow로 표시되고, 획득 항목은 `data-testid="badge-earned"`와 획득일 `2026.09.10` 캡션을, 미획득 항목은 `data-testid="badge-locked"`와 남은 금액("2억원 남음")을 표시한다

- **AC-4 [W][P1]: Scenario: 순자산 하락 시 회수 없음**
  Given `M_100M` 보유 상태에서 자산 삭제로 `netWorth === 30000000`이 됐을 때
  When `evaluateBadges()`가 실행되면
  Then `M_100M`은 저장소에 그대로 유지되고 `achievedAt`이 변경되지 않는다

- **AC-5 [E][P0]: Scenario: 무부채 뱃지**
  Given 자산 2건이 있고 `totalLiabilities === 0`일 때
  Then `M_DEBT_FREE`가 부여되고, 대출 항목을 1건이라도 추가하면 신규 부여 평가에서 제외되나 기존 뱃지는 유지된다

- **AC-6 [W][P1]: Scenario: 중복 부여 방지**
  Given `M_10M`을 이미 보유한 상태에서 저장을 3회 반복했을 때
  Then `nwp:badges:v1` 내 `id === 'M_10M'` 레코드는 정확히 1개이며 배열 길이가 증가하지 않는다

- **AC-7 [S][P1]: Scenario: 미획득 빈 상태**
  While 획득 뱃지가 0개일 때
  Then `/badges` 상단에 `Asset.ContentIcon`과 "첫 자산을 등록하면 첫 뱃지를 받아요" 문구가 표시되고 8개 행은 모두 locked 스타일로 렌더링된다

- **AC-8 [S][P1]: Scenario: 로딩 상태**
  While 뱃지 데이터 로드 전 초기 프레임 동안
  Then 목록 자리에 TDS Skeleton ListRow 4개가 표시되고 "남은 금액" 텍스트는 렌더링되지 않는다

---

### F8. 앱 셸 · 네비게이션 · 검수 준수

- **Description**: 라우터, `FloatingTabBar`, 공통 `ScreenScaffold`, 전역 에러 바운더리를 구성하고 앱인토스 검수 기준(외부 이탈 금지, HEX 하드코딩 금지, 다크모드, 콘솔 에러 0개, 구버전 OS 호환)을 코드 레벨에서 강제한다. 알 수 없는 경로 접근과 잘못된 `location.state`에 대한 폴백을 정의한다.
- **Data**: 없음 (라우팅/셸)
- **API**: 없음
- **Requirements**: `FloatingTabBar` 탭 4개 — 홈 `/`, 자산 `/assets`, 추이 `/trend`, 리포트 `/report`. `/goal`, `/badges`는 홈에서 진입.

- **AC-1 [U][P0]: Scenario: 탭 네비게이션**
  Given 앱이 실행됐을 때
  Then 하단에 템플릿 `FloatingTabBar`가 4개 탭(홈/자산/추이/리포트)으로 렌더링되고 각 탭 터치 영역이 최소 44×44px이며
  And 현재 pathname과 일치하는 탭만 활성 스타일을 갖는다

- **AC-2 [W][P0]: Scenario: 외부 도메인 이탈 차단**
  Given 앱 코드 전체를 검사했을 때
  Then `window.open` 호출과 외부 URL(`http://`/`https://`로 시작하며 자체 도메인이 아닌 값)을 대입하는 `window.location.href` 코드가 0건이고
  And 앱 설치 유도 문구("설치", "다운로드", "앱스토어", "구글플레이")를 포함한 UI 텍스트가 0건이다

- **AC-3 [U][P0]: Scenario: HEX 색상 하드코딩 금지**
  Given `src/**/*.{ts,tsx,css}`를 정규식 `#[0-9a-fA-F]{3,8}\b`로 검사했을 때
  Then 매칭 건수가 0이고, 모든 커스텀 스타일(SVG 차트 포함)은 `var(--tds-color-*)`를 사용하며 다크모드에서 텍스트/배경 대비가 유지된다

- **AC-4 [U][P0]: Scenario: 콘솔 에러 0개**
  Given `vite build` 결과물을 실행해 홈→자산→추이→리포트→목표→뱃지를 순회했을 때
  Then `console.error` 호출이 0건이고 React key 경고, 미처리 Promise rejection이 발생하지 않는다

- **AC-5 [U][P0]: Scenario: 구버전 OS 호환**
  Given 빌드 타깃이 Android 7(Chrome 60) / iOS 16 Safari일 때
  Then 번들에 `Array.prototype.at`, `Object.groupBy`, `structuredClone`, 정규식 lookbehind가 폴리필 없이 포함되지 않고
  And `crypto.randomUUID` 미지원 환경에서는 타임스탬프+난수 기반 ID 폴백이 동작한다

- **AC-6 [W][P1]: Scenario: 잘못된 경로 폴백**
  Given 유저가 `/unknown-path`로 진입했을 때
  Then "페이지를 찾을 수 없어요" 문구와 `display="block"` "홈으로" 버튼이 표시되고 버튼 탭 시 `navigate('/', { replace: true })` 된다

- **AC-7 [W][P1]: Scenario: 잘못된 라우트 파라미터 폴백**
  Given `/assets/does-not-exist/edit`로 진입해 해당 id의 자산이 없을 때
  Then Toast "항목을 찾을 수 없어요"가 표시되고 즉시 `navigate('/assets', { replace: true })` 되며 빈 폼이 렌더링되지 않는다

- **AC-8 [U][P1]: Scenario: 외부 로깅 및 외부 요청 부재**
  Given 앱 실행 중 네트워크 요청을 관찰했을 때
  Then 토스 SDK와 광고 SDK 외 외부 도메인으로의 `fetch`/`XMLHttpRequest`/스크립트 로드가 0건이고
  And `package.json` 의존성에 `analytics`, `amplitude`, `ga`, `gtag` 관련 패키지가 없다

---

## Screen Definitions

### S1. 홈 대시보드 — `/`

- **TDS 컴포넌트**: `ScreenScaffold`(템플릿), `Top`(타이틀 "순자산"), `SummaryHero`(템플릿, CountUp), `Card`, `MiniBar`(템플릿), `Sparkline`(템플릿, 최근 6개월 미니 추이), `ListRow`, `Chip`, `Button`(display="block"), `Spacing`, `Toast`, `BottomSheet`(뱃지 축하), `Asset.ContentIcon`, `Skeleton`, `AdSlot`(템플릿), `FloatingTabBar`(템플릿)
- **레이아웃 계약**:
  - `ScreenScaffold` > `Top` > `SummaryHero`(`data-testid="networth-hero"`, 순자산 t2 + 전월 대비 배지) > `Spacing size={16}` > `Card data-testid="category-breakdown"`(카테고리 4행 MiniBar) > `Card data-testid="goal-mini-card"`(목표 달성률 요약, 미설정 시 CTA) > `Card data-testid="checkin-banner"`(조건부) > `AdSlot` > `FloatingTabBar`
  - 최근 6개월 스냅샷이 2개 이상일 때만 hero 하단 `Sparkline` 표시
- **상태**: 로딩 = hero Skeleton(96px) + ListRow Skeleton 3개 / 빈 = ContentIcon + "첫 자산을 등록하고 순자산을 확인해보세요" + "자산 추가하기" 버튼 / 에러 = "데이터를 불러오지 못했어요" Card + "다시 시도" 버튼
- **터치**: 카테고리 행 탭(높이 56px) → 자산 목록 해당 카테고리 필터, 목표 Card 탭(높이 ≥ 72px) → `/goal`, 뱃지 아이콘 버튼 44×44px → `/badges`
- **Navigation state contract**:
  - Outgoing: `navigate('/assets', { state: { filterCategory: AssetCategory } })` (카테고리 행 탭) · `navigate('/assets')` (체크인 배너/빈 상태 CTA, state 없음) · `navigate('/goal')` · `navigate('/badges')`
  - Incoming: `location.state = null` (홈은 항상 state 없이 진입 가능해야 함)

### S2. 자산 목록 — `/assets`

- **TDS 컴포넌트**: `ScreenScaffold`, `Top`(타이틀 "자산", 우측 액션 "추가"), `Tab`(전체/예금/주식/부동산/대출), `ListRow`(좌: 이름·메모, 우: 금액), `Chip`, `Button`, `AlertDialog`(삭제 확인), `Toast`, `Spacing`, `Asset.ContentIcon`, `Skeleton`, `AdSlot`, `FloatingTabBar`
- **레이아웃 계약**: `ScreenScaffold` > `Top` > `Tab`(상단 카테고리 전환) > 가상 스크롤 리스트(`react-window`, 행 높이 72px, overscan 5) > `AdSlot`(리스트 하단, FloatingTabBar 위) > `FloatingTabBar`. 합계는 리스트 상단 고정 Card(`data-testid="assets-total-card"`)
- **상태**: 로딩 = ListRow Skeleton 5개 / 빈 = ContentIcon + "아직 등록한 자산이 없어요" + `display="block"` "자산 추가하기" / 에러 = "목록을 불러오지 못했어요" + "다시 시도"
- **터치**: 행 탭(전체 영역, 높이 72px) → 수정, 행 우측 삭제 아이콘 버튼 44×44px, Top 우측 "추가" 버튼 44×44px
- **Navigation state contract**:
  - Outgoing: `navigate('/assets/new')` (state 없음) · `navigate('/assets/' + id + '/edit')` (state 없음, id는 URL param)
  - Incoming: `location.state = { filterCategory: AssetCategory } | null` — 값이 있으면 해당 Tab을 초기 선택, `null`이면 "전체" 탭 선택

### S3. 자산 입력/수정 — `/assets/new`, `/assets/:id/edit`

- **TDS 컴포넌트**: `ScreenScaffold`, `Top`(뒤로가기 + 타이틀 "자산 추가"/"자산 수정"), `Chip`(카테고리 4종 단일 선택), `TextField`(이름/금액/메모), `Paragraph.Text`(에러 문구), `SubmitFooter`(템플릿, 하단 고정 "저장"), `Toast`, `AlertDialog`(수정 중 뒤로가기 시 "저장하지 않고 나갈까요?"), `Spacing`
- **레이아웃 계약**: `ScreenScaffold` > `Top` > 카테고리 Chip 행 > `TextField` 3개 > `SubmitFooter`(1차 액션, 하단 고정, safe-area 반영). 폼 내부에 `AdSlot` 배치 금지
- **키보드 대응**: 금액 필드 `inputMode="numeric"`, 이름/메모 `enterKeyHint="next"`, 포커스 시 해당 필드가 키보드 위로 스크롤(`scrollIntoView({ block: 'center' })`), SubmitFooter는 `position: fixed` + `env(safe-area-inset-bottom)`
- **상태**: 로딩(수정 모드에서 자산 조회 중) = TextField Skeleton 3개 / 빈(잘못된 id) = Toast "항목을 찾을 수 없어요" 후 `/assets` replace / 에러 = 필드 하단 인라인 에러 문구, SubmitFooter 버튼 `disabled`
- **터치**: Chip 각각 높이 44px 이상, 저장 버튼 높이 52px
- **Navigation state contract**:
  - Outgoing: 저장 성공 시 `navigate('/assets', { replace: true, state: { toast: 'saved' | 'updated' } })`
  - Incoming: `location.state = { presetCategory: AssetCategory } | null` — 값이 있으면 해당 Chip 초기 선택. URL param `id: string`(edit 모드)

### S4. 순자산 추이 — `/trend`

- **TDS 컴포넌트**: `ScreenScaffold`, `Top`("순자산 추이"), `Tab`(3개월/6개월/12개월), `Card`, 커스텀 SVG 라인차트(TDS 미제공 — flex 컨테이너만 커스텀 CSS), `ListRow`(월별 순자산 + 증감), `Chip`(증감 배지), `Spacing`, `Skeleton`, `Asset.ContentIcon`, `AdSlot`, `FloatingTabBar`
- **레이아웃 계약**: `ScreenScaffold` > `Top` > `Tab` > `Card data-testid="trend-chart-card"`(내부: 최신 순자산 t3 + `svg data-testid="trend-line-chart"`, 높이 200px, `<polyline>` + 데이터 포인트 `<circle>` r=3) > `AdSlot` > 월별 `ListRow` 목록 > `FloatingTabBar`
- **상태**: 로딩 = 차트 Skeleton 200px + ListRow Skeleton 3개 / 빈 = ContentIcon + "2개월 이상 기록하면 추이를 볼 수 있어요" / 에러 = "추이를 불러오지 못했어요" + "다시 시도"
- **터치**: 차트 데이터 포인트 탭 영역 44×44px(투명 `<rect>` 히트박스) → 해당 월 값 툴팁 표시, Tab 각 44px
- **Navigation state contract**:
  - Outgoing: `navigate('/assets')` (빈 상태 CTA, state 없음)
  - Incoming: `location.state = { initialRange: 3 | 6 | 12 } | null` — `null`이면 기본 `6`

### S5. 목표 설정 & 달성률 — `/goal`

- **TDS 컴포넌트**: `ScreenScaffold`, `Top`(뒤로가기 + "목표"), `Card`, `SummaryHero`(달성률 CountUp), 커스텀 게이지 바(`role="progressbar"`, flex 커스텀 CSS), `TextField`(목표 금액/목표 날짜), `Button`("목표 수정"), `SubmitFooter`("목표 저장"), `Chip`(달성 배지), `Toast`, `AlertDialog`(목표 삭제 확인), `Spacing`, `Asset.ContentIcon`, `Skeleton`
- **레이아웃 계약**: 조회 모드 = `ScreenScaffold` > `Top` > `Card data-testid="goal-gauge-card"`(달성률 t2 CountUp + 게이지 바 + "남은 금액") > `Card data-testid="goal-plan-card"`(목표 금액 / 목표일 / 월 필요 저축액 ListRow 3행) > `Button display="block"` "목표 수정". 편집 모드 = TextField 2개 + `SubmitFooter`
- **키보드 대응**: 목표 금액 `inputMode="numeric"` + 3자리 콤마 실시간 포맷, 목표 날짜 `<input type="date">`(iOS 16 네이티브 피커 호환)
- **상태**: 로딩 = Card Skeleton 2개 / 빈 = ContentIcon + "목표를 정하면 달성률을 볼 수 있어요" + "목표 설정하기" / 에러 = 인라인 필드 에러 문구
- **터치**: "목표 수정" 버튼 높이 52px, 삭제 아이콘 버튼 44×44px
- **Navigation state contract**:
  - Outgoing: 저장 후 `navigate('/goal', { replace: true })`(편집→조회 모드 전환은 화면 내 상태로 처리, 라우팅 없음) · 뒤로가기 → `navigate(-1)`
  - Incoming: `location.state = { openEditor: boolean } | null` — `openEditor === true`면 편집 모드로 진입, `null`이면 조회 모드(목표 미설정 시 빈 상태)

### S6. 자산배분 리포트 — `/report`

- **TDS 컴포넌트**: `ScreenScaffold`, `Top`("자산배분 리포트"), `Card`, `MiniBar`(카테고리 비중 4개), `ListRow`(진단 문구), `Chip`(부채비율 배지), `Button`(display="block" "리포트 보기"), `TossRewardAd`(템플릿, 결과 게이트), `Toast`, `Spacing`, `Skeleton`, `Asset.ContentIcon`, `AdSlot`, `FloatingTabBar`
- **레이아웃 계약**:
  - 잠금 상태: `ScreenScaffold` > `Top` > `Card`("광고를 보면 이번 달 리포트가 열려요") > `TossRewardAd`로 감싼 `Button display="block"` > `FloatingTabBar`
  - 공개 상태: `ScreenScaffold` > `Top` > `div data-testid="report-body"` { `Card data-testid="allocation-card"`(MiniBar 4행 + 총자산 t3) , `Card data-testid="diagnosis-card"`(진단 ListRow 1~3행 + 부채비율 배지) } > `AdSlot`(본문 아래) > `FloatingTabBar`
- **상태**: 로딩 = Card Skeleton 2개 / 빈 = ContentIcon + "자산을 1개 이상 등록하면 리포트를 만들 수 있어요" + "자산 추가하기" / 에러 = Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" + 잠금 상태 유지
- **터치**: "리포트 보기" 버튼 높이 52px, 진단 ListRow는 비인터랙티브(탭 핸들러 없음)
- **Navigation state contract**:
  - Outgoing: `navigate('/assets/new')` (빈 상태 CTA, state 없음)
  - Incoming: `location.state = null` (리워드 해제 여부는 state가 아닌 `AppMeta.reportUnlockedMonth`로만 판단 — state 기반 우회 금지)

### S7. 마일스톤 뱃지 — `/badges`

- **TDS 컴포넌트**: `ScreenScaffold`, `Top`(뒤로가기 + "마일스톤"), `ListRow`(뱃지 행, 좌: 아이콘, 중: 라벨, 우: 획득일 or 남은 금액), `Chip`(획득 배지), `Card`(획득 개수 요약 "8개 중 3개"), `BottomSheet`(신규 획득 축하), `Spacing`, `Skeleton`, `Asset.ContentIcon`
- **레이아웃 계약**: `ScreenScaffold` > `Top` > `Card data-testid="badge-summary"`(획득 개수 t3) > 뱃지 8행 ListRow(`data-testid="badge-earned"` / `data-testid="badge-locked"`) . 목록 8행 고정이므로 가상 스크롤 미적용
- **상태**: 로딩 = ListRow Skeleton 4개 / 빈(획득 0개) = 상단 ContentIcon + "첫 자산을 등록하면 첫 뱃지를 받아요", 8행은 모두 locked / 에러 = "뱃지를 불러오지 못했어요" + "다시 시도"
- **터치**: 뒤로가기 44×44px, BottomSheet "확인" 버튼 높이 48px. 뱃지 행 자체는 비인터랙티브
- **Navigation state contract**:
  - Outgoing: `navigate(-1)` (뒤로가기)
  - Incoming: `location.state = { highlightBadgeId: MilestoneId } | null` — 값이 있으면 해당 행에 강조 배경 1.5초 적용

### S8. 404 폴백 — `*`

- **TDS 컴포넌트**: `ScreenScaffold`, `Asset.ContentIcon`, `Paragraph.Text`, `Button`(display="block")
- **레이아웃 계약**: `ScreenScaffold` 중앙 정렬(커스텀 flex CSS 허용) > ContentIcon > "페이지를 찾을 수 없어요" > `Button display="block"` "홈으로"
- **상태**: 단일 상태(로딩/빈/에러 구분 없음)
- **터치**: "홈으로" 버튼 높이 52px
- **Navigation state contract**:
  - Outgoing: `navigate('/', { replace: true })`
  - Incoming: 없음

---

## API Contract

**외부 API 호출 없음.** 모든 데이터는 localStorage에 저장되며 네트워크 요청은 토스 SDK(광고/세션)만 사용한다. 따라서 REST 엔드포인트, CORS 설정, 에러 응답 스키마 정의 대상이 없다.

내부 스토리지 레이어 함수 시그니처는 다음 통일 결과 타입을 사용한다(에러 응답 형태를 API 규약과 동일하게 `{ error: string }` 계열로 통일):

```ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };   // error는 사용자에게 그대로 노출되는 한국어 문구

export function listAssets(): Asset[];
export function createAsset(input: AssetInput): Result<Asset>;
export function updateAsset(id: string, input: Partial<AssetInput>): Result<Asset>;
export function deleteAsset(id: string): Result<{ id: string }>;
export function computeSummary(assets: Asset[], prev?: NetWorthSnapshot): NetWorthSummary;

export function upsertSnapshot(summary: NetWorthSummary, month: string): Result<NetWorthSnapshot>;
export function listSnapshots(range: 3 | 6 | 12): NetWorthSnapshot[];

export function getGoal(): Goal | null;
export function saveGoal(input: { targetAmount: number; targetDate: string }): Result<Goal>;
export function clearGoal(): Result<null>;

export function listBadges(): Badge[];
export function evaluateBadges(summary: NetWorthSummary, assetCount: number): Badge[]; // 신규 획득분만 반환

export function getMeta(): AppMeta;
export function patchMeta(patch: Partial<AppMeta>): Result<AppMeta>;
```

**에러 문구 사전(고정 문자열, 테스트에서 정확 일치 검증)**

| 코드 상황 | 문구 |
|---|---|
| 용량 초과 | `저장 공간이 부족해요. 오래된 항목을 삭제해주세요` |
| 항목 수 상한 | `자산은 최대 200개까지 등록할 수 있어요` |
| 이름/금액 미입력 | `이름과 금액을 확인해주세요` |
| 금액 하한 | `금액을 1원 이상 입력해주세요` |
| 금액 상한 | `금액은 999,999,999,999원까지 입력할 수 있어요` |
| 이름 길이 | `이름은 20자까지 입력할 수 있어요` |
| 목표 금액 하한 | `목표 금액을 1원 이상 입력해주세요` |
| 목표 금액 상한 | `목표 금액은 999,999,999,999원까지 입력할 수 있어요` |
| 목표 날짜 | `목표 날짜는 오늘 이후로 정해주세요` |
| 항목 없음 | `항목을 찾을 수 없어요` |
| 광고 실패 | `광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요` |
| 조회 실패 | `데이터를 불러오지 못했어요` |

---

## Work Packet Mapping (참고)

| Feature | 예상 패킷 수 | 분할 |
|---|---|---|
| F1 데이터 레이어 | 2 | (a) Asset CRUD + 손상/용량 복구, (b) computeSummary + 스냅샷 upsert |
| F2 목록/폼 UI | 3 | (a) 목록 + 가상 스크롤 + 빈/로딩, (b) 입력 폼 + 검증 + 키보드, (c) 수정/삭제 + AlertDialog |
| F3 홈 | 2 | (a) hero + 카테고리 Card + 상태들, (b) 체크인 배너 + AdSlot |
| F4 추이 | 2 | (a) SVG 라인차트 + 엣지케이스, (b) 기간 Tab + 월별 목록 + AdSlot |
| F5 목표 | 2 | (a) 설정 폼 + 검증, (b) 게이지 + 계산 표시 |
| F6 리포트 | 2 | (a) 룰 엔진 + 계산, (b) TossRewardAd 게이팅 + 본문 Card |
| F7 뱃지 | 2 | (a) evaluateBadges + 저장, (b) 목록 화면 + 축하 BottomSheet |
| F8 셸/검수 | 1 | 라우터 + FloatingTabBar + 404/폴백 + 검수 린트 룰 |
| **합계** | **16 패킷** | (MIN 4 충족) |

---

## Assumptions

- **A1**: 자산 금액은 유저가 직접 입력하며, 토스 계좌 연동·시세 자동 반영은 MVP 범위 밖이다(PRD "수동 입력" 근거).
- **A2**: 부채는 `loan` 카테고리 하나로 통합하며 양수로 저장한 뒤 집계 시 차감한다. 대출 이자율·상환 스케줄은 다루지 않는다.
- **A3**: 스냅샷 단위는 월(`YYYY-MM`)이며 같은 달 내 여러 번 수정하면 마지막 값으로 덮어쓴다. 일 단위 이력은 저장하지 않는다.
- **A4**: "주간 체크인 알림"은 푸시 알림이 아닌 인앱 홈 배너로 구현한다(MVP 제약: 푸시 미사용).
- **A5**: 마일스톤 임계값 8종과 진단 룰 6종은 PRD에 없어 본 SPEC에서 정의했다. 확정 전 변경 가능.
- **A6**: 리워드 광고 해제 주기는 "월 1회"로 가정했다(리포트가 월 단위 스냅샷 기반이므로). 세션 1회/일 1회 정책은 Open Question Q2 참조.
- **A7**: 자산배분 리포트는 고정 룰 테이블 기반의 결정론적 계산이며 생성형 AI를 호출하지 않는다. 따라서 AI 사전 고지·AI 결과물 라벨 요구사항은 적용 대상이 아니다. 만약 향후 LLM 기반 코멘트를 도입하면 F6에 AI 고지 AC 2개를 추가해야 한다.
- **A8**: `getIsTossLoginIntegratedService()`는 앱 부팅 시 1회 호출해 로그 없이 결과만 보관하며, 데이터는 기기 로컬(localStorage)에만 저장되므로 유저별 서버 분리는 필요 없다.
- **A9**: 다중 기기 동기화는 지원하지 않는다(localStorage 단독). 기기 변경 시 데이터는 이전되지 않는다.
- **A10**: 배너 광고는 홈/자산목록/추이/리포트 4개 화면에 각 1개씩만 노출하며, 한 화면에 2개 이상 배치하지 않는다.

## Open Questions

- **Q1**: 자산 카테고리를 4종(예금/주식/부동산/대출)으로 고정할지, 유저 정의 카테고리 추가를 허용할지? (현재 SPEC은 4종 고정)
- **Q2**: 리워드 광고 해제 주기 — 월 1회(현재 가정) vs 조회 1회당 vs 일 1회? 수익(MRR 12만원 목표)과 UX 균형에 대한 결정 필요.
- **Q3**: 마일스톤 임계값(1천만/5천만/1억/3억/5억/10억)과 뱃지 라벨이 타깃 유저(사회초년생~중년층)에게 적절한지 검증 필요. 사회초년생 대상 하위 구간(100만/500만) 추가 여부.
- **Q4**: 데이터 백업/복원(JSON export-import) 기능이 필요한가? 기기 변경 시 전체 데이터 소실 리스크가 있으나 MVP 범위 밖으로 제외했다.
- **Q5**: 스냅샷 60개월 상한 도달 시 오래된 데이터를 삭제하는 정책이 맞는지, 아니면 연 단위로 압축 보관할지?
- **Q6**: 목표는 1개만 허용(현재 SPEC)인가, 아니면 "내 집 마련", "은퇴 자금" 등 복수 목표를 지원해야 하는가?
- **Q7**: 프로모션 리워드(`grantPromotionReward`, 1인당 최대 5,000원)를 신규 유저 획득 캠페인에 사용할 계획이 있는가? 있다면 promotionCode 발급과 지급 조건(예: 첫 자산 3건 등록) 정의 필요. 현재 SPEC은 미사용.