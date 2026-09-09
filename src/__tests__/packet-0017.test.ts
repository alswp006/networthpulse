import { describe, it, expect } from "vitest";
import React from "react";
import { screen, within } from "@testing-library/react";
import type { Asset, AssetCategory, DiagnosisItem, NetWorthSummary } from "@/lib/types";
import { computeSummary } from "@/lib/calc/summary";
import { diagnose } from "@/lib/calc/diagnose";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

mockTds();
mockAppsInToss();

// 아직 존재하지 않는 구현 — Coder가 작성한다
import { ReportBody } from "@/components/ReportBody";

function makeAsset(category: AssetCategory, amount: number): Asset {
  return {
    id: `${category}-${amount}`,
    name: category,
    category,
    amount,
    memo: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

// AC-1/AC-5 시나리오: deposit 5,000,000 / stock 10,000,000 / realestate 300,000,000 / loan 200,000,000
const ASSETS: Asset[] = [
  makeAsset("deposit", 5_000_000),
  makeAsset("stock", 10_000_000),
  makeAsset("realestate", 300_000_000),
  makeAsset("loan", 200_000_000),
];

const SUMMARY: NetWorthSummary = computeSummary(ASSETS);
const DIAGNOSIS: DiagnosisItem[] = diagnose(SUMMARY);

describe("리포트 본문 — 배분 Card · 진단 Card · AdSlot", () => {
  it("AC-1[P0]: deposit/stock/realestate/loan 조합에서 부채비율이 '63.5%'로 표시된다", () => {
    // computeSummary가 산출한 debtRatio 자체가 63.5여야 하고, 화면은 그 값을 그대로 표시해야 한다
    expect(SUMMARY.debtRatio).toBe(63.5);

    renderWithRouter(
      React.createElement(ReportBody, { summary: SUMMARY, diagnosis: DIAGNOSIS }),
    );

    const debtRatioEl = screen.getByTestId("debt-ratio");
    expect(debtRatioEl.textContent).toBe("63.5%");
  });

  it("AC-2[P0]: 배분 Card에 4개 카테고리가 라벨·퍼센트(소수 1자리)·MiniBar로 렌더되고 퍼센트 합이 100.0% ±0.2 이내다", () => {
    const { container } = renderWithRouter(
      React.createElement(ReportBody, { summary: SUMMARY, diagnosis: DIAGNOSIS }),
    );

    const card = screen.getByTestId("allocation-card");

    // 라벨 4개
    expect(within(card).getByText("예금")).toBeTruthy();
    expect(within(card).getByText("주식")).toBeTruthy();
    expect(within(card).getByText("부동산")).toBeTruthy();
    expect(within(card).getByText("대출")).toBeTruthy();

    // MiniBar(progressbar) 4개
    const bars = within(card).getAllByRole("progressbar");
    expect(bars.length).toBe(4);

    // 퍼센트 텍스트 4개, 합계 100.0 ±0.2
    const percentEls = container.querySelectorAll('[data-testid^="allocation-percent-"]');
    expect(percentEls.length).toBe(4);

    let sum = 0;
    percentEls.forEach((el) => {
      const value = parseFloat((el.textContent ?? "").replace("%", ""));
      expect(Number.isNaN(value)).toBe(false);
      sum += value;
    });
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.2);
  });

  it("AC-3[P0]: diagnose() 결과 항목 수만큼 진단 항목이 렌더되고 warn/good 톤이 서로 다른 색상 토큰으로 구분된다", () => {
    const mixedDiagnosis: DiagnosisItem[] = [
      {
        id: "R_DEBT_HIGH",
        title: "부채비율이 높아요",
        description: "총자산 대비 부채가 60% 이상이에요. 부채 상환을 우선 검토해보세요",
        tone: "warn",
      },
      {
        id: "R_DEBT_OK",
        title: "부채비율이 안정적이에요",
        description: "부채비율이 30% 미만으로 안정적이에요",
        tone: "good",
      },
    ];

    renderWithRouter(
      React.createElement(ReportBody, { summary: SUMMARY, diagnosis: mixedDiagnosis }),
    );

    const card = screen.getByTestId("diagnosis-card");
    const items = within(card).getAllByTestId(/^diagnosis-item-/);
    expect(items.length).toBe(2);

    expect(items[0].getAttribute("data-tone")).toBe("warn");
    expect(items[1].getAttribute("data-tone")).toBe("good");

    const warnColor = items[0].style.color;
    const goodColor = items[1].style.color;
    expect(warnColor).not.toBe("");
    expect(goodColor).not.toBe("");
    expect(warnColor).not.toBe(goodColor);
  });

  it("AC-4[P0]: ReportBody 소스 코드에 직접 나눗셈/반올림 연산이 없고 computeSummary·diagnose 결과만 참조한다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/ReportBody.tsx"),
      "utf-8",
    );

    // 화면에서 직접 반올림/나눗셈 연산을 하지 않고, 이미 계산된 summary/diagnosis 값만 표시해야 한다
    expect(source.includes("Math.round(")).toBe(false);
    expect(source.includes(".toFixed(")).toBe(false);
    expect(/summary\.\w+\s*\/\s*summary\.\w+/.test(source)).toBe(false);
  });

  it("AC-5[P0]: 본문 하단에 AdSlot이 1회 렌더되고 외부 앱 유도 문구('설치'/'다운로드')가 0건이다", () => {
    const { container } = renderWithRouter(
      React.createElement(ReportBody, { summary: SUMMARY, diagnosis: DIAGNOSIS }),
    );

    const adSlots = container.querySelectorAll(".ad-slot, [data-ad-group-id]");
    expect(adSlots.length).toBe(1);

    const diagnosisCard = screen.getByTestId("diagnosis-card");
    const adSlotFollowsDiagnosisCard =
      (diagnosisCard.compareDocumentPosition(adSlots[0]) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(adSlotFollowsDiagnosisCard).toBe(true);

    expect(container.textContent ?? "").not.toMatch(/설치|다운로드/);
  });
});
