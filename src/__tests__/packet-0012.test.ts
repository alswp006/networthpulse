import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { Asset, AssetInput, Result } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";

import { mockTds, mockAppsInToss, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

mockTds();
mockAppsInToss();

// ── @/lib/store mock — real AppData context path (see packet-0011.test.ts) ──
const mockAddAsset = vi.fn(
  (input: AssetInput): Result<Asset> => ({
    ok: true,
    data: {
      id: "new-asset-1",
      name: input.name.trim(),
      category: input.category,
      amount: input.amount,
      memo: input.memo ?? "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
);

vi.mock("@/lib/store", () => ({
  useAppData: () => ({
    loaded: true,
    assets: [],
    summary: undefined,
    snapshots: [],
    goal: null,
    badges: [],
    meta: { lastCheckInAt: null, reportUnlockedMonth: null, schemaVersion: 1 },
    newBadges: [],
    addAsset: mockAddAsset,
    editAsset: vi.fn(),
    removeAsset: vi.fn(),
    setGoal: vi.fn(),
    checkIn: vi.fn(),
    consumeBadge: vi.fn(),
  }),
  AppDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import AssetNew from "@/pages/AssetNew";

describe("자산 추가 폼 — /assets/new", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAddAsset.mockClear();
    mockLocation.state = null;
    mockLocation.pathname = "/assets/new";
  });

  it("AC-1[P0]: 이름 공백만 입력 후 저장 시 에러 문구가 표시되고 화면 이동이 발생하지 않는다", async () => {
    mockAddAsset.mockReturnValueOnce({ ok: false, error: "이름과 금액을 확인해주세요" });
    renderWithRouter(React.createElement(AssetNew));

    fireEvent.change(screen.getByTestId("asset-name-input"), { target: { value: "   " } });
    fireEvent.change(screen.getByTestId("asset-amount-input"), { target: { value: "10000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByText("이름과 금액을 확인해주세요")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-2[P0]: 금액 입력 시 3자리 콤마가 표시되고 저장되는 값은 정수다", async () => {
    renderWithRouter(React.createElement(AssetNew));

    const amountInput = screen.getByTestId("asset-amount-input") as HTMLInputElement;
    expect(amountInput.getAttribute("inputMode")).toBe("numeric");

    fireEvent.change(amountInput, { target: { value: "12000000" } });
    expect(amountInput.value).toBe("12,000,000");

    fireEvent.change(screen.getByTestId("asset-name-input"), { target: { value: "월급통장" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockAddAsset).toHaveBeenCalledTimes(1);
    });
    expect(mockAddAsset).toHaveBeenCalledWith(
      expect.objectContaining({ name: "월급통장", amount: 12000000 }),
    );
  });

  it("AC-3: location.state.presetCategory가 'stock'이면 주식 Chip이 선택된 상태로 열린다", () => {
    mockLocation.state = { presetCategory: "stock" };
    renderWithRouter(React.createElement(AssetNew));

    expect(screen.getByRole("button", { name: CATEGORY_LABEL.stock })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: CATEGORY_LABEL.deposit })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("AC-3b: location.state가 null이어도 크래시 없이 기본값 '예금'이 선택된다", () => {
    mockLocation.state = null;

    expect(() => renderWithRouter(React.createElement(AssetNew))).not.toThrow();
    expect(screen.getByRole("button", { name: CATEGORY_LABEL.deposit })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("AC-4[P0]: 저장 성공 시 navigate('/assets', { state: { toast: 'saved' }, replace: true })가 호출된다", async () => {
    renderWithRouter(React.createElement(AssetNew));

    fireEvent.change(screen.getByTestId("asset-name-input"), { target: { value: "비상금" } });
    fireEvent.change(screen.getByTestId("asset-amount-input"), { target: { value: "5000000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/assets", {
      state: { toast: "saved" },
      replace: true,
    });
  });

  it("AC-5[P0]: createAsset이 ok:false를 반환하면 반환된 error 문자열이 그대로 표시되고 이동이 발생하지 않는다", async () => {
    mockAddAsset.mockReturnValueOnce({
      ok: false,
      error: "금액은 999,999,999,999원까지 입력할 수 있어요",
    });
    renderWithRouter(React.createElement(AssetNew));

    fireEvent.change(screen.getByTestId("asset-name-input"), { target: { value: "건물" } });
    fireEvent.change(screen.getByTestId("asset-amount-input"), {
      target: { value: "999999999999999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(
        screen.getByText("금액은 999,999,999,999원까지 입력할 수 있어요"),
      ).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-6: 하단 저장 버튼은 중첩 없는 단일 CTA로 화면당 하나만 존재한다", () => {
    // FixedBottomCTA(safe-area/48px 높이)는 TDS 실컴포넌트 계약이라 mock에선 실스타일을
    // 관측할 수 없다 — 여기선 SubmitFooter 정상 배선(버튼 중첩 없는 단일 CTA)만 검증한다.
    renderWithRouter(React.createElement(AssetNew));

    const saveButtons = screen.getAllByRole("button", { name: "저장" });
    expect(saveButtons).toHaveLength(1);
    expect(saveButtons[0].tagName).toBe("BUTTON");
    expect(saveButtons[0].querySelector("button")).toBeNull();
  });
});
