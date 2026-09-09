import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safeRead, safeWrite, uid, nowISO, currentMonth } from "@/lib/storage/core";

describe("저장소 코어 유틸 (안전 read/write, ID 폴백)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-1: safeRead with broken JSON returns fallback and reinitializes key
  describe("AC-1: safeRead with broken JSON", () => {
    it("returns fallback when JSON parsing fails", () => {
      localStorage.setItem("nwp:assets:v1", "{broken");

      const result = safeRead("nwp:assets:v1", []);

      expect(result).toEqual([]);
    });

    it("reinitializes key with stringified fallback value", () => {
      localStorage.setItem("nwp:assets:v1", "{broken");

      safeRead("nwp:assets:v1", []);

      expect(localStorage.getItem("nwp:assets:v1")).toBe("[]");
    });

    it("does not throw and does not call console.error or console.warn", () => {
      localStorage.setItem("nwp:broken", "not a valid json");
      const consoleErrorSpy = vi.spyOn(console, "error");
      const consoleWarnSpy = vi.spyOn(console, "warn");

      let thrown = false;
      try {
        safeRead("nwp:broken", { default: "fallback" });
      } catch {
        thrown = true;
      }

      expect(thrown).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  // AC-2: safeWrite catches QuotaExceededError and returns error message
  describe("AC-2: safeWrite with QuotaExceededError", () => {
    it("returns error object with correct message when QuotaExceededError occurs", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      setItemSpy.mockImplementation(() => {
        const error = new DOMException("QuotaExceededError", "QuotaExceededError");
        throw error;
      });

      const result = safeWrite("nwp:test", { value: 100 });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("저장 공간이 부족해요. 오래된 항목을 삭제해주세요");
    });

    it("does not modify existing value when QuotaExceededError occurs", () => {
      const existingValue = { existing: "value" };
      localStorage.setItem("nwp:test", JSON.stringify(existingValue));

      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      setItemSpy.mockImplementation((key, value) => {
        if (key === "nwp:test") {
          const error = new DOMException("QuotaExceededError", "QuotaExceededError");
          throw error;
        }
        localStorage.setItem(key, value);
      });

      safeWrite("nwp:test", { new: "value" });

      expect(localStorage.getItem("nwp:test")).toBe(JSON.stringify(existingValue));
    });
  });

  // AC-3: uid() generates unique IDs without crypto.randomUUID
  describe("AC-3: uid() with crypto fallback", () => {
    it("returns string of at least 8 characters when crypto.randomUUID unavailable", () => {
      const originalCrypto = globalThis.crypto;
      // @ts-ignore - temporarily disable randomUUID
      Object.defineProperty(globalThis, "crypto", {
        value: { randomUUID: undefined },
        configurable: true,
      });

      const result = uid();

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThanOrEqual(8);

      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    });

    it("generates 1000 unique IDs with zero duplicates", () => {
      const originalCrypto = globalThis.crypto;
      // @ts-ignore
      Object.defineProperty(globalThis, "crypto", {
        value: { randomUUID: undefined },
        configurable: true,
      });

      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(uid());
      }

      expect(ids.size).toBe(1000);

      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    });
  });

  // AC-4: currentMonth() returns YYYY-MM format
  describe("AC-4: currentMonth() format", () => {
    it("returns YYYY-MM format (2026-09 for 2026-09-10)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));

      const result = currentMonth();

      expect(result).toBe("2026-09");

      vi.useRealTimers();
    });

    it("handles month/year boundaries correctly", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-31T23:59:59Z"));

      const result = currentMonth();

      expect(result).toBe("2025-12");

      vi.useRealTimers();
    });
  });

  // Happy path: safeRead with valid JSON
  describe("Happy path: safeRead and safeWrite", () => {
    it("safeRead returns parsed object when JSON is valid", () => {
      const data = { count: 42, name: "test" };
      localStorage.setItem("nwp:data", JSON.stringify(data));

      const result = safeRead("nwp:data", {});

      expect(result).toEqual(data);
      expect(result.count).toBe(42);
      expect(result.name).toBe("test");
    });

    it("safeWrite returns success and persists data to localStorage", () => {
      const data = { value: 100, label: "savings" };

      const result = safeWrite("nwp:savings", data);

      expect(result.ok).toBe(true);
      expect(localStorage.getItem("nwp:savings")).toBe(JSON.stringify(data));
    });

    it("nowISO() returns valid ISO 8601 timestamp", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-10T12:34:56.789Z"));

      const result = nowISO();

      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result).toBe("2026-09-10T12:34:56.789Z");

      vi.useRealTimers();
    });

    it("uid() uses crypto.randomUUID when available and returns valid format", () => {
      const result = uid();

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThanOrEqual(8);
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(result).toMatch(/^[0-9a-f\-]+$/i);
    });
  });
});
