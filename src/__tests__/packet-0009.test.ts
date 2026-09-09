import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import type { AppMeta, Goal, Badge, NetWorthSummary, AssetCategory } from "@/lib/types";

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

const EMPTY_CATEGORY: Record<AssetCategory, number> = {
  deposit: 0,
  stock: 0,
  realestate: 0,
  loan: 0,
};

function makeSummary(netWorth: number): NetWorthSummary {
  return {
    totalAssets: netWorth,
    totalLiabilities: 0,
    netWorth,
    byCategory: { ...EMPTY_CATEGORY, deposit: netWorth },
    categoryRatio: { ...EMPTY_CATEGORY, deposit: 100 },
    debtRatio: 0,
    momDelta: null,
  };
}

function makeMeta(overrides: Partial<AppMeta> = {}): AppMeta {
  return { lastCheckInAt: null, reportUnlockedMonth: null, schemaVersion: 1, ...overrides };
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function baseAppData(overrides: Record<string, unknown> = {}) {
  return {
    loaded: true,
    assets: [],
    summary: makeSummary(0),
    snapshots: [],
    goal: null as Goal | null,
    badges: [] as Badge[],
    meta: makeMeta(),
    newBadges: [] as Badge[],
    addAsset: vi.fn(),
    editAsset: vi.fn(),
    removeAsset: vi.fn(),
    setGoal: vi.fn(),
    checkIn: vi.fn(),
    consumeBadge: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockNavigate.mockClear();
  vi.mocked(generateHapticFeedback).mockClear();
  vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "nwp-home-banner");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// 아직 존재하지 않는 구현 — Coder가 작성한다
import { CheckInBanner } from "@/components/CheckInBanner";
import { GoalMiniCard } from "@/components/GoalMiniCard";
import { BadgeCelebrationSheet } from "@/components/BadgeCelebrationSheet";
import Home from "@/pages/Home";

describe("홈 — 체크인 배너 · 목표 미니 카드 · 뱃지 축하 BottomSheet · AdSlot", () => {
  // ─────────────────────────────────────────────────────────────
  // AC-1: 체크인 배너 노출 조건 (8일 경과)
  // ─────────────────────────────────────────────────────────────
  describe("AC-1: CheckInBanner 노출", () => {
    it("lastCheckInAt이 8일 전이면 체크인 배너와 '지금 업데이트' 버튼이 렌더된다", () => {
      const checkIn = vi.fn();
      mockUseAppData.mockReturnValue(
        baseAppData({ meta: makeMeta({ lastCheckInAt: daysAgoISO(8) }), checkIn }),
      );

      renderWithRouter(React.createElement(CheckInBanner));

      const banner = screen.getByTestId("checkin-banner");
      const bannerText = within(banner).getByText("7일 동안 자산을 업데이트하지 않았어요");
      expect(bannerText.textContent).toBe("7일 동안 자산을 업데이트하지 않았어요");

      const button = within(banner).getByRole("button", { name: "지금 업데이트" });
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("display")).toBe("block");
    });

    it("lastCheckInAt이 1일 전이면 체크인 배너가 렌더되지 않는다", () => {
      mockUseAppData.mockReturnValue(
        baseAppData({ meta: makeMeta({ lastCheckInAt: daysAgoISO(1) }) }),
      );

      renderWithRouter(React.createElement(CheckInBanner));

      expect(screen.queryByTestId("checkin-banner")).toBeNull();
      expect(screen.queryByText(/자산을 업데이트하지 않았어요/)).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC-2: 체크인 배너 탭 동작
  // ─────────────────────────────────────────────────────────────
  describe("AC-2: CheckInBanner 탭 동작", () => {
    it("'지금 업데이트' 탭 시 checkIn 호출 → /assets 이동 → 배너가 사라지고 success 햅틱이 발생한다", () => {
      const checkIn = vi.fn();
      mockUseAppData.mockReturnValue(
        baseAppData({ meta: makeMeta({ lastCheckInAt: daysAgoISO(8) }), checkIn }),
      );

      renderWithRouter(React.createElement(CheckInBanner));

      fireEvent.click(screen.getByRole("button", { name: "지금 업데이트" }));

      expect(checkIn).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/assets");
      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
      expect(screen.queryByTestId("checkin-banner")).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC-3: 목표 미니 카드
  // ─────────────────────────────────────────────────────────────
  describe("AC-3: GoalMiniCard", () => {
    it("goal이 null이면 '목표 설정하기'가 표시되고 탭 시 /goal로 이동한다", () => {
      mockUseAppData.mockReturnValue(baseAppData({ goal: null, summary: makeSummary(0) }));

      renderWithRouter(React.createElement(GoalMiniCard));

      const card = screen.getByTestId("goal-mini-card");
      const label = within(card).getByText("목표 설정하기");
      expect(label.textContent).toBe("목표 설정하기");

      fireEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith("/goal");
    });

    it("goal이 설정돼 있으면 '달성률 40.0%' 형식으로 표시되고 탭 시 /goal로 이동한다", () => {
      const goal: Goal = {
        targetAmount: 100_000_000,
        targetDate: "2027-01-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      mockUseAppData.mockReturnValue(
        baseAppData({ goal, summary: makeSummary(40_000_000) }),
      );

      renderWithRouter(React.createElement(GoalMiniCard));

      const card = screen.getByTestId("goal-mini-card");
      const label = within(card).getByText("달성률 40.0%");
      expect(label.textContent).toBe("달성률 40.0%");

      fireEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith("/goal");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC-4: 뱃지 축하 BottomSheet
  // ─────────────────────────────────────────────────────────────
  describe("AC-4: BadgeCelebrationSheet", () => {
    it("newBadges가 비어있지 않으면 '1억원 달성!' 문구와 '확인' 버튼이 있는 시트가 열린다", () => {
      const badge: Badge = { id: "M_100M", achievedAt: daysAgoISO(0), netWorthAt: 100_000_000 };
      mockUseAppData.mockReturnValue(baseAppData({ newBadges: [badge] }));

      renderWithRouter(React.createElement(BadgeCelebrationSheet));

      const sheet = screen.getByRole("dialog");
      const text = within(sheet).getByText("1억원 달성!");
      expect(text.textContent).toBe("1억원 달성!");
      const confirmButton = within(sheet).getByRole("button", { name: "확인" });
      expect(confirmButton.tagName).toBe("BUTTON");
    });

    it("newBadges가 비어있으면 시트가 열리지 않는다", () => {
      mockUseAppData.mockReturnValue(baseAppData({ newBadges: [] }));

      renderWithRouter(React.createElement(BadgeCelebrationSheet));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText(/달성!/)).toBeNull();
    });

    it("'확인' 탭 시 consumeBadge(badge.id)가 호출되고 같은 뱃지로 시트가 재오픈되지 않는다", () => {
      const consumeBadge = vi.fn();
      const badge: Badge = { id: "M_100M", achievedAt: daysAgoISO(0), netWorthAt: 100_000_000 };
      mockUseAppData.mockReturnValue(baseAppData({ newBadges: [badge], consumeBadge }));

      renderWithRouter(React.createElement(BadgeCelebrationSheet));

      fireEvent.click(screen.getByRole("button", { name: "확인" }));

      expect(consumeBadge).toHaveBeenCalledTimes(1);
      expect(consumeBadge).toHaveBeenCalledWith("M_100M");
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC-5: Home의 AdSlot 배치
  // ─────────────────────────────────────────────────────────────
  describe("AC-5: Home AdSlot 배치", () => {
    it("카테고리 카드 아래에 AdSlot이 static 배치로 렌더되고 adGroupId가 env 값과 일치한다", () => {
      mockUseAppData.mockReturnValue(
        baseAppData({
          meta: makeMeta({ lastCheckInAt: daysAgoISO(0) }),
          goal: null,
          newBadges: [],
          assets: [
            {
              id: "deposit-1",
              name: "예금자산",
              category: "deposit" as AssetCategory,
              amount: 100_000_000,
              memo: "",
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-01T00:00:00.000Z",
            },
          ],
          summary: makeSummary(100_000_000),
        }),
      );

      const { container } = renderWithRouter(React.createElement(Home));

      const adSlot = container.querySelector("[data-ad-group-id]");
      expect(adSlot).not.toBeNull();
      expect(adSlot!.getAttribute("data-ad-group-id")).toBe("nwp-home-banner");
      expect((adSlot as HTMLElement).style.position).not.toBe("fixed");

      const highlights = container.querySelector('[data-testid="home-highlights"]');
      expect(highlights).not.toBeNull();
      const adSlotFollowsHighlights =
        (highlights!.compareDocumentPosition(adSlot!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      expect(adSlotFollowsHighlights).toBe(true);
    });
  });
});
