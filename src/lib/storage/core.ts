import type { Result } from '@/lib/types';
import { ERROR_MESSAGES } from '@/lib/types';

// 위치(index)가 아닌 문구로 찾는다 — ERROR_MESSAGES 배열 순서가 바뀌어도 안전
const QUOTA_ERROR_MESSAGE = ERROR_MESSAGES.find(
  (msg) => msg === '저장 공간이 부족해요. 오래된 항목을 삭제해주세요',
)!;
const WRITE_FAILED_MESSAGE = '저장에 실패했어요. 잠시 후 다시 시도해주세요';

/** JSON 파싱 실패 시 fallback을 반환하고 손상된 키를 fallback으로 재초기화한다. 예외/콘솔 출력 없음 */
export function safeRead<T = any>(key: string, fallback: NoInfer<T>): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

/** localStorage.setItem 실패(용량 초과 등)를 catch해 Result로 반환한다 */
export function safeWrite<T>(key: string, value: T): Result<null> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, data: null };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return { ok: false, error: QUOTA_ERROR_MESSAGE };
    }
    return { ok: false, error: WRITE_FAILED_MESSAGE };
  }
}

/** crypto.randomUUID 미지원 시 Date.now + Math.random 폴백 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** 'YYYY-MM' 형식의 현재 월 */
export function currentMonth(): string {
  return nowISO().slice(0, 7);
}

/** 저장소에서 읽기. 키가 없거나 파싱 실패 시 null(safeRead의 fallback 재초기화 포함) */
export async function readStorage(key: string): Promise<any> {
  return safeRead(key, null);
}

/** 저장소에 쓰기. 실패(용량 초과 등) 시 원인 메시지를 담은 Error를 throw */
export async function writeStorage(key: string, data: any): Promise<void> {
  const result = safeWrite(key, data);
  if (!result.ok) {
    throw new Error(result.error);
  }
}

/** 저장소에서 키 삭제 */
export async function deleteStorage(key: string): Promise<void> {
  localStorage.removeItem(key);
}

/** fn 실행 결과를 { data }로, 예외를 { error }로 감싸는 트랜잭션 래퍼 */
export async function withStorageTransaction<T>(
  fn: (err?: Error) => Promise<T> | T,
): Promise<{ data?: T; error?: Error }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}
