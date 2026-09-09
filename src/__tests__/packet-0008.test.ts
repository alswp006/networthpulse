import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import type { Asset, AssetCategory, NetWorthSnapshot, NetWorthSummary } from "@/lib/types";

import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

// react-router-dom mock (per CLAUDE.md pattern)
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

mockTds();
mockAppsInToss();

// ── @/lib/store mock — this project's actual AppData context path ──
const mockUseAppData = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppData: () => mockUseAppData(),
  AppDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// generateHapticFeedback spy — pulled from the mocked SDK module
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

// 아직 존재하지 않는 구현 — Coder가 작성한다
import Home from "@/pages/Home";

const EMPTY_CATEGORY: Record<AssetCategory, number> = {
  deposit: 0,
  stock: 0,
  realestate: 0,
  loan: 0,
};

function makeSummary(netWorth: number, momDelta: number | null): NetWorthSummary {
  return {
    totalAssets: netWorth + 50_000_000,
    totalLiabilities: 50_000_000,
    netWorth,
    byCategory: { deposit: 100_000_000, stock: 80_000_000, realestate: 70_000_000, loan: 50_000_000 },
    categoryRatio: { deposit: 40, stock: 32, realestate: 28, loan: 0 },
    debtRatio: 20,
    momDelta,
  };
}

function makeAsset(category: AssetCategory, amount: number): Asset {
  return {
    id: `${category}-1`,
    name: `${category}자산`,
    category,
    amount,
    memo: "",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function makeSnapshot(month: string, netWorth: number): NetWorthSnapshot {
  return {
    month,
    totalAssets: netWorth + 50_000_000,
    totalLiabilities: 50_000_000,
    netWorth,
    byCategory: { ...EMPTY_CATEGORY, deposit: netWorth },
    capturedAt: `${month}-01T00:00:00.000Z`,
  };
}

const SAMPLE_ASSETS: Asset[] = [
  makeAsset("deposit", 100_000_000),
  makeAsset("stock", 80_000_000),
  makeAsset("realestate", 70_000_000),
  makeAsset("loan", 50_000_000),
];

// Home이 useAppData()에서 구조분해하는 필드 전체 — CheckInBanner/GoalMiniCard/BadgeCelebrationSheet가
// meta/goal/newBadges/checkIn/consumeBadge를 요구하므로 기본값을 채워 항상 완전한 shape을 반환한다.
function baseHomeData(overrides: Record<string, unknown>) {
  return {
    meta: { lastCheckInAt: new Date().toISOString(), reportUnlockedMonth: null, schemaVersion: 1 },
    goal: null,
    badges: [],
    newBadges: [],
    checkIn: vi.fn(),
    consumeBadge: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAppData.mockReset();
  mockNavigate.mockClear();
  vi.mocked(generateHapticFeedback).mockClear();
});

describe("홈 대시보드 — hero · 카테고리 Card · 빈/로딩", () => {
  it("AC-1[P0]: loaded===false면 Skeleton(히어로 height 96 1개 + 카테고리 3개)만 보이고 숫자는 렌더되지 않는다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: false,
      assets: [],
      summary: undefined,
      snapshots: [],
    }));

    renderWithRouter(React.createElement(Home));

    expect(screen.getByTestId("hero-skeleton")).toHaveStyle({ height: "96px" });
    expect(screen.getAllByTestId("category-skeleton")).toHaveLength(3);
    expect(screen.queryByTestId("networth-hero")).toBeNull();
    expect(screen.queryByTestId("category-card")).toBeNull();
  });

  it("AC-1[P0]: loaded===true로 바뀌면 Skeleton 대신 실제 숫자가 나타난다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: false,
      assets: [],
      summary: undefined,
      snapshots: [],
    }));
    const { rerender } = renderWithRouter(React.createElement(Home));
    expect(screen.getByTestId("hero-skeleton")).toBeInTheDocument();

    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: SAMPLE_ASSETS,
      summary: makeSummary(200_000_000, null),
      snapshots: [],
    }));
    rerender(React.createElement(Home));

    expect(screen.queryByTestId("hero-skeleton")).toBeNull();
    expect(screen.getByTestId("networth-hero").textContent).toContain("200,000,000원");
  });

  it("AC-2: 자산 0건이면 EmptyState + '자산 추가하기' 전체폭 CTA가 보이고 카테고리 Card는 렌더되지 않는다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: [],
      summary: makeSummary(0, null),
      snapshots: [],
    }));

    renderWithRouter(React.createElement(Home));

    expect(screen.getByText("아직 순자산 기록이 없어요")).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "자산 추가하기" });
    expect(cta).toHaveAttribute("display", "block");
    expect(screen.queryByTestId("category-card")).toBeNull();
  });

  it("AC-3[P0]: 자산이 있으면 순자산이 3자리 콤마+원으로, 전월 대비 델타가 '+20,000,000원 (+11.1%)' 형식으로 표시된다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: SAMPLE_ASSETS,
      summary: makeSummary(200_000_000, 20_000_000),
      snapshots: [makeSnapshot("2026-07", 180_000_000), makeSnapshot("2026-08", 200_000_000)],
    }));

    const { container } = renderWithRouter(React.createElement(Home));

    expect(screen.getByTestId("networth-hero").textContent).toContain("200,000,000원");
    expect(container.textContent).toContain("+20,000,000원 (+11.1%)");
  });

  it("AC-3[P0]: 전월 스냅샷이 없어 momDelta가 null이면 대비 Chip 문구가 렌더되지 않는다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: SAMPLE_ASSETS,
      summary: makeSummary(200_000_000, null),
      snapshots: [makeSnapshot("2026-08", 200_000_000)],
    }));

    const { container } = renderWithRouter(React.createElement(Home));

    expect(screen.getByTestId("networth-hero").textContent).toContain("200,000,000원");
    expect(container.textContent).not.toContain("%)");
  });

  it("AC-4: 스냅샷이 2개 미만이면 Sparkline이 없고, 2개 이상이면 렌더된다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: SAMPLE_ASSETS,
      summary: makeSummary(200_000_000, null),
      snapshots: [makeSnapshot("2026-08", 200_000_000)],
    }));
    const { unmount } = renderWithRouter(React.createElement(Home));
    expect(screen.queryByRole("img", { name: "추이 그래프" })).toBeNull();
    unmount();

    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: SAMPLE_ASSETS,
      summary: makeSummary(200_000_000, 20_000_000),
      snapshots: [makeSnapshot("2026-07", 180_000_000), makeSnapshot("2026-08", 200_000_000)],
    }));
    renderWithRouter(React.createElement(Home));
    expect(screen.getByRole("img", { name: "추이 그래프" })).toBeInTheDocument();
  });

  it("AC-5: 카테고리 행 탭 시 navigate('/assets', { state: { filterCategory } })와 haptic tickWeak가 호출된다", () => {
    mockUseAppData.mockReturnValue(baseHomeData({
      loaded: true,
      assets: SAMPLE_ASSETS,
      summary: makeSummary(200_000_000, null),
      snapshots: [],
    }));

    renderWithRouter(React.createElement(Home));

    const stockRow = screen.getByTestId("category-row-stock");
    stockRow.click();

    expect(mockNavigate).toHaveBeenCalledWith("/assets", { state: { filterCategory: "stock" } });
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  it("AC-6: Home.tsx 소스에 HEX 색상 하드코딩과 margin/padding 인라인 스타일이 없다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/pages/Home.tsx"), "utf-8");

    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/\bmargin(?:Top|Bottom|Left|Right)?\s*:/.test(source)).toBe(false);
    expect(/\bpadding(?:Top|Bottom|Left|Right)?\s*:/.test(source)).toBe(false);
  });
});
