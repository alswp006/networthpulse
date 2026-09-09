import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Result } from "@/lib/types";
import {
  createAsset,
  updateAsset,
  deleteAsset,
  listAssets,
  getAsset,
} from "@/lib/storage/assets";

// Result<T> 판별 유니온에서 실패/성공 분기를 좁혀 꺼내는 테스트 헬퍼
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

function unwrapError<T>(result: Result<T>): string {
  if (result.ok) throw new Error("expected an error result");
  return result.error;
}

describe("Asset CRUD 저장소 [packet 0005]", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ============================================================================
  // AC-1: 빈 저장소에서 정상 생성
  // ============================================================================
  it("AC-1[P0]: should create asset with all required fields and timestamps", () => {
    const input = {
      name: "국민은행 예금",
      category: "deposit" as const,
      amount: 12000000,
      memo: "비상금",
    };

    const result = createAsset(input);

    expect(result.ok).toBe(true);
    expect(unwrap(result).id).toBeTruthy();
    expect(unwrap(result).id).not.toBe("");
    expect(unwrap(result).name).toBe("국민은행 예금");
    expect(unwrap(result).category).toBe("deposit");
    expect(unwrap(result).amount).toBe(12000000);
    expect(unwrap(result).memo).toBe("비상금");
    expect(unwrap(result).createdAt).toBe(unwrap(result).updatedAt);
    expect(listAssets()).toHaveLength(1);
    expect(listAssets()[0].id).toBe(unwrap(result).id);
  });

  // ============================================================================
  // AC-2: 업데이트 & 삭제 시퀀스
  // ============================================================================
  it("AC-2[P0]: should update asset and change updatedAt timestamp", () => {
    const created = createAsset({
      name: "국민은행 예금",
      category: "deposit" as const,
      amount: 12000000,
      memo: "",
    });

    expect(created.ok).toBe(true);
    const id = unwrap(created).id;
    const originalCreatedAt = unwrap(created).createdAt;
    const originalUpdatedAt = unwrap(created).updatedAt;

    // 약간의 시간 경과 (시간 테스트용)
    vi.useFakeTimers();
    vi.advanceTimersByTime(100);

    const updated = updateAsset(id, { amount: 7000000 });

    expect(updated.ok).toBe(true);
    expect(unwrap(updated).id).toBe(id);
    expect(unwrap(updated).amount).toBe(7000000);
    expect(unwrap(updated).name).toBe("국민은행 예금"); // 변경 안 한 필드는 유지
    expect(unwrap(updated).createdAt).toBe(originalCreatedAt); // createdAt은 변경 안 됨
    expect(unwrap(updated).updatedAt > originalUpdatedAt).toBe(true);

    vi.useRealTimers();
  });

  it("AC-2[P0]: should delete asset and return empty list", () => {
    const created = createAsset({
      name: "국민은행 예금",
      category: "deposit" as const,
      amount: 12000000,
      memo: "",
    });

    expect(created.ok).toBe(true);
    const id = unwrap(created).id;

    const deleteResult = deleteAsset(id);

    expect(deleteResult.ok).toBe(true);
    expect(unwrap(deleteResult).id).toBe(id);
    expect(listAssets()).toHaveLength(0);
  });

  // ============================================================================
  // AC-3: 검증 실패 — name/amount 필수값
  // ============================================================================
  it("AC-3[P0]: should reject empty name after trim or zero amount", () => {
    const result = createAsset({
      name: "  ",
      category: "deposit" as const,
      amount: 0,
      memo: "",
    });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toBe("이름과 금액을 확인해주세요");
    expect(listAssets()).toHaveLength(0);
  });

  it("AC-3[P0]: should reject empty name only", () => {
    const result = createAsset({
      name: "",
      category: "deposit" as const,
      amount: 1000,
      memo: "",
    });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toBe("이름과 금액을 확인해주세요");
    expect(listAssets()).toHaveLength(0);
  });

  it("AC-3[P0]: should reject amount less than 1", () => {
    const result = createAsset({
      name: "테스트",
      category: "deposit" as const,
      amount: 0,
      memo: "",
    });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toBe("이름과 금액을 확인해주세요");
    expect(listAssets()).toHaveLength(0);
  });

  it("AC-3[P0]: should reject name longer than 20 characters", () => {
    const result = createAsset({
      name: "a".repeat(21),
      category: "deposit" as const,
      amount: 1000,
      memo: "",
    });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toContain("이름");
    expect(unwrapError(result)).toContain("20");
    expect(listAssets()).toHaveLength(0);
  });

  it("AC-3[P0]: should reject amount exceeding max limit (999,999,999,999)", () => {
    const result = createAsset({
      name: "테스트",
      category: "deposit" as const,
      amount: 999_999_999_999 + 1,
      memo: "",
    });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toContain("금액");
    expect(listAssets()).toHaveLength(0);
  });

  // ============================================================================
  // AC-4: 저장소 상한 (200건)
  // ============================================================================
  it("AC-4[P0]: should reject create when exceeding 200 item limit", () => {
    // 200개 생성
    for (let i = 0; i < 200; i++) {
      const res = createAsset({
        name: `Asset ${String(i).padStart(3, "0")}`,
        category: "deposit" as const,
        amount: 1000 + i,
        memo: "",
      });
      expect(res.ok).toBe(true);
    }

    expect(listAssets()).toHaveLength(200);

    // 201번째 시도
    const result = createAsset({
      name: "Asset 201",
      category: "deposit" as const,
      amount: 2000,
      memo: "",
    });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toBe("자산은 최대 200개까지 등록할 수 있어요");
    expect(listAssets()).toHaveLength(200);
  });

  // ============================================================================
  // AC-5: safeWrite 실패 시 불변성 (데이터 복구)
  // ============================================================================
  it("AC-5[P0]: should preserve existing data if write fails due to quota error", () => {
    // 정상 생성
    const created = createAsset({
      name: "국민은행 예금",
      category: "deposit" as const,
      amount: 12000000,
      memo: "",
    });

    expect(created.ok).toBe(true);
    const id = unwrap(created).id;

    // 깊은 복사로 기존 상태 저장
    const originalAssets = JSON.parse(JSON.stringify(listAssets()));

    // localStorage.setItem을 quota 초과 에러로 시뮬레이션
    // 주의: jsdom의 Storage는 Proxy 기반이라 `localStorage.setItem = vi.fn()` 같은 직접 대입은
    // 메서드를 가리지 못하고 조용히 무시된다 — Storage.prototype을 spyOn해야 실제로 가로챈다.
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      });

    // 금액 초과로 인한 검증 실패도 고려 — 실제로는 검증에서 걸릴 수 있으므로,
    // 여기서는 단순히 update 후 write 실패 케이스만 테스트
    const result = updateAsset(id, { amount: 5000 });
    expect(result.ok).toBe(false);

    spy.mockRestore();

    // write 실패 시: 기존 데이터가 깊은 비교로 불변이어야 함
    const currentAssets = listAssets();
    expect(JSON.parse(JSON.stringify(currentAssets))).toEqual(originalAssets);
  });

  // ============================================================================
  // AC-6: 없는 ID 처리 — update/delete/get
  // ============================================================================
  it("AC-6[P0]: should return error for updateAsset with non-existent id", () => {
    const result = updateAsset("non-existent-id-xyz", { amount: 5000 });

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toBe("항목을 찾을 수 없어요");
  });

  it("AC-6[P0]: should return null for getAsset with non-existent id (no throw)", () => {
    const result = getAsset("non-existent-id-xyz");

    expect(result).toBeNull();
  });

  it("AC-6[P0]: should return error for deleteAsset with non-existent id", () => {
    const result = deleteAsset("non-existent-id-xyz");

    expect(result.ok).toBe(false);
    expect(unwrapError(result)).toBe("항목을 찾을 수 없어요");
  });

  // ============================================================================
  // 추가: name trim 처리 확인
  // ============================================================================
  it("should trim whitespace from name on create", () => {
    const result = createAsset({
      name: "  국민은행 예금  ",
      category: "deposit" as const,
      amount: 1000,
      memo: "",
    });

    expect(result.ok).toBe(true);
    expect(unwrap(result).name).toBe("국민은행 예금");
  });

  it("should trim whitespace from name on update", () => {
    const created = createAsset({
      name: "테스트",
      category: "deposit" as const,
      amount: 1000,
      memo: "",
    });

    const updated = updateAsset(unwrap(created).id, {
      name: "  수정됨  ",
    });

    expect(updated.ok).toBe(true);
    expect(unwrap(updated).name).toBe("수정됨");
  });
});
