import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { NetWorthChart } from "@/components/NetWorthChart";
import type { NetWorthSnapshot } from "@/lib/types";

function makeSnapshot(month: string, netWorth: number): NetWorthSnapshot {
  return {
    month,
    totalAssets: netWorth >= 0 ? netWorth : 0,
    totalLiabilities: netWorth >= 0 ? 0 : -netWorth,
    netWorth,
    byCategory: { deposit: 0, stock: 0, realestate: 0, loan: 0 },
    capturedAt: `${month}-01T00:00:00.000Z`,
  };
}

const SIX_SNAPSHOTS: NetWorthSnapshot[] = [
  makeSnapshot("2026-01", 1000000),
  makeSnapshot("2026-02", 1500000),
  makeSnapshot("2026-03", 1200000),
  makeSnapshot("2026-04", 2000000),
  makeSnapshot("2026-05", 2500000),
  makeSnapshot("2026-06", 3000000),
];

describe("추이 화면 — SVG 라인차트 + 엣지케이스", () => {
  it("AC-1[P0]: 스냅샷 6개 입력 시 path d 속성에 NaN/Infinity가 없고 점 6개가 렌더된다", () => {
    const { container } = render(React.createElement(NetWorthChart, { data: SIX_SNAPSHOTS }));

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
    for (const path of Array.from(paths)) {
      const d = path.getAttribute("d") ?? "";
      expect(d.includes("NaN")).toBe(false);
      expect(d.includes("Infinity")).toBe(false);
    }

    const points = container.querySelectorAll("[data-testid='chart-point']");
    expect(points.length).toBe(6);
  });

  it("AC-2[P0]: 스냅샷 1개면 점 1개만 렌더되고 크래시가 없다", () => {
    const single = [makeSnapshot("2026-01", 1000000)];
    expect(() => render(React.createElement(NetWorthChart, { data: single }))).not.toThrow();

    const { container } = render(React.createElement(NetWorthChart, { data: single }));
    const points = container.querySelectorAll("[data-testid='chart-point']");
    expect(points.length).toBe(1);
    const paths = container.querySelectorAll("path[data-testid='chart-line']");
    expect(paths.length).toBe(0);
  });

  it("AC-2b: 스냅샷 0개면 크래시 없이 빈 상태로 렌더된다", () => {
    expect(() => render(React.createElement(NetWorthChart, { data: [] }))).not.toThrow();
    const { container } = render(React.createElement(NetWorthChart, { data: [] }));
    const points = container.querySelectorAll("[data-testid='chart-point']");
    expect(points.length).toBe(0);
  });

  it("AC-3: 모든 값이 동일할 때 y좌표가 중앙 수평선이고 0 나눗셈이 없다", () => {
    const flat = [
      makeSnapshot("2026-01", 1000000),
      makeSnapshot("2026-02", 1000000),
      makeSnapshot("2026-03", 1000000),
      makeSnapshot("2026-04", 1000000),
    ];
    const { container } = render(React.createElement(NetWorthChart, { data: flat }));

    const points = Array.from(container.querySelectorAll("[data-testid='chart-point']"));
    expect(points.length).toBe(4);
    const ys = points.map((p) => Number(p.getAttribute("cy")));
    for (const y of ys) {
      expect(Number.isNaN(y)).toBe(false);
      expect(Number.isFinite(y)).toBe(true);
    }
    // all y values equal (horizontal line)
    expect(new Set(ys).size).toBe(1);

    const linePath = container.querySelector("path[data-testid='chart-line']");
    expect(linePath?.getAttribute("d")?.includes("NaN")).toBe(false);
  });

  it("AC-4[P0]: 음수 순자산이 포함되면 0 기준선이 표시되고 음수 지점은 기준선 아래에 그려진다", () => {
    const withNegative: NetWorthSnapshot[] = [
      makeSnapshot("2026-01", -500000),
      makeSnapshot("2026-02", 1000000),
      makeSnapshot("2026-03", 2000000),
    ];
    const { container } = render(React.createElement(NetWorthChart, { data: withNegative }));

    const zeroLine = container.querySelector("[data-testid='chart-zero-line']");
    expect(zeroLine).not.toBeNull();
    const zeroY = Number(zeroLine?.getAttribute("y1"));
    expect(Number.isFinite(zeroY)).toBe(true);

    const points = Array.from(container.querySelectorAll("[data-testid='chart-point']"));
    expect(points.length).toBe(3);
    const negativePointY = Number(points[0].getAttribute("cy"));
    // SVG y increases downward, so a point below the zero-baseline has a larger y value
    expect(negativePointY).toBeGreaterThan(zeroY);
  });

  it("AC-5: SVG가 width=100% + viewBox로 렌더되어 고정 px width가 없다", () => {
    const { container } = render(React.createElement(NetWorthChart, { data: SIX_SNAPSHOTS }));
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("100%");
    expect(svg?.getAttribute("viewBox")).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
  });

  it("AC-6: stroke/fill 색상은 var(--tds-color-*)만 사용하고 HEX가 없다", () => {
    const { container } = render(React.createElement(NetWorthChart, { data: SIX_SNAPSHOTS }));
    const svg = container.querySelector("svg");
    const html = svg?.outerHTML ?? "";

    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);

    const strokedEls = Array.from(svg?.querySelectorAll("[stroke], [fill]") ?? []).filter(
      (el) => el.getAttribute("stroke") !== "none" && el.getAttribute("fill") !== "none",
    );
    const colorAttrs = strokedEls.flatMap((el) => [
      el.getAttribute("stroke"),
      el.getAttribute("fill"),
    ]).filter((v): v is string => !!v && v !== "none");

    expect(colorAttrs.length).toBeGreaterThan(0);
    for (const color of colorAttrs) {
      expect(color.startsWith("var(--tds-color-")).toBe(true);
    }
  });
});
