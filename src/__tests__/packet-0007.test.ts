import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import type { AssetInput } from "@/lib/types";
import { currentMonth } from "@/lib/storage/core";

// 아직 존재하지 않는 구현 — Coder가 src/lib/store.tsx에 작성한다
import { AppDataProvider, useAppData } from "@/lib/store";

type AppData = ReturnType<typeof useAppData>;

beforeEach(() => {
  localStorage.clear();
});

/** 매 렌더마다 최신 훅 값을 latest에 반영하고, 렌더 시퀀스를 renders에 누적하는 테스트 하네스 */
function makeHarness() {
  const renders: AppData[] = [];
  let latest: AppData;
  function Harness() {
    latest = useAppData();
    renders.push(latest);
    return null;
  }
  return {
    Harness,
    renders,
    get latest() {
      return latest;
    },
  };
}

function renderWithProvider() {
  const harness = makeHarness();
  render(React.createElement(AppDataProvider, null, React.createElement(harness.Harness)));
  return harness;
}

const ASSET_A: AssetInput = { name: "월급통장", category: "deposit", amount: 15_000_000, memo: "" };
const ASSET_B: AssetInput = { name: "적금", category: "deposit", amount: 5_000_000, memo: "" };

// ─────────────────────────────────────────────────────────────────────
// AC-1[P0]: useAppData 반환 shape
// ─────────────────────────────────────────────────────────────────────

describe("AC-1[P0]: useAppData 반환 shape", () => {
  it("로드 완료 후 모든 필드/액션을 올바른 타입으로 반환한다", async () => {
    const harness = renderWithProvider();
    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    const data = harness.latest;
    expect(typeof data.loaded).toBe("boolean");
    expect(Array.isArray(data.assets)).toBe(true);
    expect(typeof data.summary).toBe("object");
    expect(Array.isArray(data.snapshots)).toBe(true);
    expect(data.goal === null || typeof data.goal === "object").toBe(true);
    expect(Array.isArray(data.badges)).toBe(true);
    expect(typeof data.meta).toBe("object");
    expect(Array.isArray(data.newBadges)).toBe(true);
    expect(typeof data.addAsset).toBe("function");
    expect(typeof data.editAsset).toBe("function");
    expect(typeof data.removeAsset).toBe("function");
    expect(typeof data.setGoal).toBe("function");
    expect(typeof data.checkIn).toBe("function");
    expect(typeof data.consumeBadge).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-2: 초기 loaded===false → 로드 후 true, 로드 전 summary 미노출
// ─────────────────────────────────────────────────────────────────────

describe("AC-2: 초기 로드 상태 전환", () => {
  it("첫 렌더는 loaded=false·summary 미노출이고, 로드 후 loaded=true·summary가 노출된다", async () => {
    const harness = renderWithProvider();

    expect(harness.renders[0].loaded).toBe(false);
    expect(harness.renders[0].summary).toBeUndefined();

    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    expect(harness.latest.summary).toBeDefined();
    expect(typeof harness.latest.summary?.netWorth).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-3[P0]: addAsset 성공 — assets+1, summary 재계산, 스냅샷 upsert(월 중복 0)
// ─────────────────────────────────────────────────────────────────────

describe("AC-3[P0]: addAsset 성공 시 상태 갱신", () => {
  it("자산 1건 추가 시 assets 길이+1, summary.netWorth 재계산, 현재 달 스냅샷이 1건 생성된다", async () => {
    const harness = renderWithProvider();
    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    act(() => {
      harness.latest.addAsset(ASSET_A);
    });

    await waitFor(() => expect(harness.latest.assets.length).toBe(1));
    expect(harness.latest.summary?.netWorth).toBe(15_000_000);
    const monthSnapshots = harness.latest.snapshots.filter((s) => s.month === currentMonth());
    expect(monthSnapshots.length).toBe(1);
    expect(monthSnapshots[0].netWorth).toBe(15_000_000);
  });

  it("같은 달에 자산을 두 번 추가해도 해당 월 스냅샷은 1건으로 upsert된다(중복 없음)", async () => {
    const harness = renderWithProvider();
    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    act(() => {
      harness.latest.addAsset(ASSET_A);
    });
    await waitFor(() => expect(harness.latest.assets.length).toBe(1));

    act(() => {
      harness.latest.addAsset(ASSET_B);
    });
    await waitFor(() => expect(harness.latest.assets.length).toBe(2));

    expect(harness.latest.summary?.netWorth).toBe(20_000_000);
    const monthSnapshots = harness.latest.snapshots.filter((s) => s.month === currentMonth());
    expect(monthSnapshots.length).toBe(1); // month 중복 0건
    expect(monthSnapshots[0].netWorth).toBe(20_000_000); // 최신 값으로 덮어쓰기
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-4[P0]: 순자산 10,000,000 최초 돌파 → newBadges에 M_10M, consumeBadge 후 재노출 없음
// ─────────────────────────────────────────────────────────────────────

describe("AC-4[P0]: 뱃지 자동 평가 큐(newBadges)", () => {
  it("순자산이 10,000,000을 처음 넘기면 newBadges에 M_10M 뱃지가 담긴다", async () => {
    const harness = renderWithProvider();
    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    act(() => {
      harness.latest.addAsset(ASSET_A); // 15,000,000 → 10M 돌파
    });

    await waitFor(() => {
      expect(harness.latest.newBadges.some((b) => b.id === "M_10M")).toBe(true);
    });
    const badge = harness.latest.newBadges.find((b) => b.id === "M_10M")!;
    expect(typeof badge.achievedAt).toBe("string");
    expect(badge.netWorthAt).toBe(15_000_000);
    expect(harness.latest.badges.some((b) => b.id === "M_10M")).toBe(true);
  });

  it("consumeBadge(M_10M) 호출 후에는 newBadges에 M_10M이 다시 나타나지 않는다", async () => {
    const harness = renderWithProvider();
    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    act(() => {
      harness.latest.addAsset(ASSET_A);
    });
    await waitFor(() => expect(harness.latest.newBadges.some((b) => b.id === "M_10M")).toBe(true));

    act(() => {
      harness.latest.consumeBadge("M_10M");
    });
    expect(harness.latest.newBadges.some((b) => b.id === "M_10M")).toBe(false);

    // 뱃지 재평가를 유발할 후속 자산 변경 후에도 M_10M은 다시 큐에 담기지 않는다(이미 부여됨)
    act(() => {
      harness.latest.addAsset(ASSET_B);
    });
    await waitFor(() => expect(harness.latest.assets.length).toBe(2));
    expect(harness.latest.newBadges.some((b) => b.id === "M_10M")).toBe(false);
    expect(harness.latest.badges.some((b) => b.id === "M_10M")).toBe(true); // 뱃지 자체는 유지
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-5: addAsset 실패(ok:false) — 상태 불변 + error 문자열 그대로 전달
// ─────────────────────────────────────────────────────────────────────

describe("AC-5: addAsset 실패 처리", () => {
  it("이름이 빈 값이면 상태가 바뀌지 않고 에러 문구가 그대로 반환된다", async () => {
    const harness = renderWithProvider();
    await waitFor(() => expect(harness.latest.loaded).toBe(true));

    let result: ReturnType<AppData["addAsset"]> | undefined;
    act(() => {
      result = harness.latest.addAsset({ name: "", category: "deposit", amount: 10_000, memo: "" });
    });

    expect(result?.ok).toBe(false);
    expect(result?.ok === false && result.error).toBe("이름과 금액을 확인해주세요");
    expect(harness.latest.assets.length).toBe(0);
    expect(harness.latest.summary?.netWorth).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// AC-6: Provider 밖에서 useAppData 호출 시 에러
// ─────────────────────────────────────────────────────────────────────

describe("AC-6: Provider 가드", () => {
  it("AppDataProvider 없이 useAppData를 호출하면 명확한 에러를 던진다", () => {
    function Unwrapped() {
      useAppData();
      return null;
    }

    expect(() => render(React.createElement(Unwrapped))).toThrow(/AppDataProvider/);
  });
});
