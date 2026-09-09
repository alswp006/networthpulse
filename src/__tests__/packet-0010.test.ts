import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import type { Asset } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { formatKRW } from "@/lib/format";

import { mockTds, mockAppsInToss, mockTossRewardAd, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

mockTds();
mockAppsInToss();
mockTossRewardAd();

// react-router-dom mock (per CLAUDE.md pattern) — useNavigate + useLocation
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// ── @/lib/store mock — mutable holder so each test can configure assets/loaded ──
let mockAssets: Asset[] = [];
let mockLoaded = true;

vi.mock("@/lib/store", () => ({
  useAppData: () => ({
    loaded: mockLoaded,
    assets: mockAssets,
  }),
  AppDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import Assets from "@/pages/Assets";

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: "id-" + Math.random().toString(36).slice(2),
    name: "자산",
    category: "deposit",
    amount: 1000,
    memo: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const DEPOSIT: Asset = makeAsset({ id: "a1", name: "월급통장", category: "deposit", amount: 3_200_000, memo: "" });
const STOCK: Asset = makeAsset({ id: "a2", name: "삼성전자", category: "stock", amount: 1_500_000, memo: "적립식" });
const REALESTATE: Asset = makeAsset({ id: "a3", name: "전세보증금", category: "realestate", amount: 200_000_000, memo: "" });
const LOAN: Asset = makeAsset({ id: "a4", name: "학자금대출", category: "loan", amount: 5_000_000, memo: "" });

function getRowMinHeight(row: HTMLElement): number {
  const raw = row.style.minHeight || row.style.height;
  return parseFloat(raw || "0");
}

describe("자산 목록 화면 — 리스트 · 합계 · 탭 필터 · 빈/로딩", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocation.state = null;
    mockLocation.pathname = "/assets";
    mockAssets = [DEPOSIT, STOCK, REALESTATE, LOAN];
    mockLoaded = true;
  });

  it("AC-1[P0]: filterCategory in location.state selects the matching tab and filters the list", () => {
    mockLocation.state = { filterCategory: "realestate" };
    renderWithRouter(React.createElement(Assets));

    expect(screen.getByRole("tab", { name: "부동산", selected: true })).toBeInTheDocument();
    const rows = screen.getAllByTestId("asset-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("전세보증금");
  });

  it("AC-1[P0]: null location.state falls back to the '전체' tab without crashing", () => {
    mockLocation.state = null;
    renderWithRouter(React.createElement(Assets));

    expect(screen.getByRole("tab", { name: "전체", selected: true })).toBeInTheDocument();
    expect(screen.getAllByTestId("asset-row")).toHaveLength(4);
  });

  it("AC-2: switching to the '대출' tab filters the list to loan assets and updates the total card", () => {
    renderWithRouter(React.createElement(Assets));

    // 전체 탭 초기 합계 — 4개 자산 총합
    const totalBefore = 3_200_000 + 1_500_000 + 200_000_000 + 5_000_000;
    expect(screen.getByTestId("assets-total-card")).toHaveTextContent(formatKRW(totalBefore));

    fireEvent.click(screen.getByRole("tab", { name: "대출" }));

    const rows = screen.getAllByTestId("asset-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("학자금대출");
    expect(screen.getByTestId("assets-total-card")).toHaveTextContent(formatKRW(5_000_000));
  });

  it("AC-3: each row shows name(top), memo-or-category(bottom), a 3-digit-comma amount, and is at least 72px tall", () => {
    renderWithRouter(React.createElement(Assets));

    const rows = screen.getAllByTestId("asset-row");
    const stockRow = rows.find((r) => r.textContent?.includes("삼성전자"));
    const depositRow = rows.find((r) => r.textContent?.includes("월급통장"));
    expect(stockRow).toBeDefined();
    expect(depositRow).toBeDefined();

    // memo가 있으면 memo를, 없으면 카테고리 라벨을 bottom으로 표시
    expect(stockRow).toHaveTextContent("적립식");
    expect(depositRow).toHaveTextContent(CATEGORY_LABEL.deposit);

    expect(stockRow).toHaveTextContent(formatKRW(1_500_000));
    expect(stockRow!.textContent).toMatch(/1,500,000/);

    for (const row of rows) {
      expect(getRowMinHeight(row)).toBeGreaterThanOrEqual(72);
    }
  });

  it("AC-4: zero assets shows an EmptyState with a '자산 추가하기' CTA", () => {
    mockAssets = [];
    renderWithRouter(React.createElement(Assets));

    expect(screen.queryAllByTestId("asset-row")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "자산 추가하기" })).toBeInTheDocument();
  });

  it("AC-4b: a filtered category with zero matches shows the category-empty copy (assets exist overall)", () => {
    mockAssets = [DEPOSIT, REALESTATE, LOAN]; // no 'stock' assets
    renderWithRouter(React.createElement(Assets));

    fireEvent.click(screen.getByRole("tab", { name: "주식" }));

    expect(screen.queryAllByTestId("asset-row")).toHaveLength(0);
    expect(screen.getByText("이 카테고리에 등록한 자산이 없어요")).toBeInTheDocument();
  });

  it("AC-5[P0]: while loaded===false, exactly 3 skeleton rows render and no total is shown", () => {
    mockLoaded = false;
    renderWithRouter(React.createElement(Assets));

    expect(screen.getAllByRole("presentation")).toHaveLength(3);
    expect(screen.queryByTestId("assets-total-card")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("asset-row")).toHaveLength(0);
  });

  it("AC-6: tapping the '추가' button navigates to /assets/new", () => {
    renderWithRouter(React.createElement(Assets));

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/assets/new");
  });
});
