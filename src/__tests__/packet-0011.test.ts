import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import type { Asset } from "@/lib/types";

import { mockTds, mockAppsInToss, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

// react-router-dom mock (per CLAUDE.md pattern)
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

mockTds();
mockAppsInToss();

// ── @/lib/store mock — this project's actual AppData context path (see packet-0009.test.ts) ──
const mockRemoveAsset = vi.fn(() => ({ ok: true, data: { id: "asset-1" } }));
vi.mock("@/lib/store", () => ({
  useAppData: () => ({
    loaded: true,
    assets: [],
    removeAsset: mockRemoveAsset,
  }),
  AppDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import AssetRowActions from "@/components/AssetRowActions";
import { ToastHost, TOAST_MESSAGES } from "@/components/ToastHost";

const testAsset: Asset = {
  id: "asset-1",
  name: "월급통장",
  category: "deposit",
  amount: 3_200_000,
  memo: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("자산 목록 — 삭제 AlertDialog · Toast · 수정 진입", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRemoveAsset.mockClear();
    mockLocation.state = null;
    mockLocation.pathname = "/assets";
  });

  it("AC-1: tapping the row's delete button opens an AlertDialog with the exact copy and '닫기' as the left button", () => {
    renderWithRouter(React.createElement(AssetRowActions, { asset: testAsset }));

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    const dialog = screen.getByRole("alertdialog", { name: "삭제할까요?" });
    expect(within(dialog).getByText("삭제한 자산은 되돌릴 수 없어요")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "닫기" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
  });

  it("AC-2[P0]: confirming delete calls removeAsset(id) and shows the '삭제했어요' toast", () => {
    renderWithRouter(React.createElement(AssetRowActions, { asset: testAsset }));

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "삭제할까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(mockRemoveAsset).toHaveBeenCalledTimes(1);
    expect(mockRemoveAsset).toHaveBeenCalledWith("asset-1");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("삭제했어요");
  });

  it("AC-3: tapping '닫기' only closes the dialog without deleting anything", () => {
    renderWithRouter(React.createElement(AssetRowActions, { asset: testAsset }));

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "삭제할까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(mockRemoveAsset).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("AC-4[P0]: clicking the delete button does not propagate to the row click (no navigation to edit)", () => {
    renderWithRouter(React.createElement(AssetRowActions, { asset: testAsset }));

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(0);
  });

  it("AC-5: tapping the row body navigates to the edit screen", () => {
    renderWithRouter(React.createElement(AssetRowActions, { asset: testAsset }));

    fireEvent.click(screen.getByTestId("asset-row-body"));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/assets/asset-1/edit");
  });

  it("AC-6[P0]: shows the matching toast once for location.state.toast and does not repeat it on re-render", () => {
    mockLocation.state = { toast: "deleted" };
    const { rerender } = renderWithRouter(React.createElement(ToastHost));

    expect(screen.getByRole("status")).toHaveTextContent(TOAST_MESSAGES.deleted);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/assets", expect.objectContaining({ replace: true, state: null }));

    rerender(React.createElement(ToastHost));

    // 같은 location.state 참조로 재렌더돼도 navigate(clear)와 toast 표시가 다시 트리거되지 않는다
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("AC-6b: renders nothing when location.state has no toast field", () => {
    mockLocation.state = null;
    renderWithRouter(React.createElement(ToastHost));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("TOAST_MESSAGES centralizes the copy for saved/updated/deleted", () => {
    expect(TOAST_MESSAGES.saved).toBe("저장했어요");
    expect(TOAST_MESSAGES.updated).toBe("수정했어요");
    expect(TOAST_MESSAGES.deleted).toBe("삭제했어요");
  });
});
