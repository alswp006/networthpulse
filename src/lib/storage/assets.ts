import type { Asset, AssetInput, Result } from '@/lib/types';
import { AMOUNT_MAX, AMOUNT_MIN, ASSET_MAX_COUNT, ERROR_MESSAGES, STORAGE_KEYS } from '@/lib/types';
import { nowISO, safeRead, safeWrite, uid } from '@/lib/storage/core';

const KEY = STORAGE_KEYS.assets;

// 위치(index)가 아닌 문구로 찾는다 — ERROR_MESSAGES 배열 순서가 바뀌어도 안전
function findMessage(text: string): string {
  return ERROR_MESSAGES.find((msg) => msg === text)!;
}

const NAME_AMOUNT_ERROR = findMessage('이름과 금액을 확인해주세요');
const NAME_LENGTH_ERROR = findMessage('이름은 20자까지 입력할 수 있어요');
const AMOUNT_MAX_ERROR = findMessage('금액은 999,999,999,999원까지 입력할 수 있어요');
const MAX_COUNT_ERROR = findMessage('자산은 최대 200개까지 등록할 수 있어요');
const NOT_FOUND_ERROR = findMessage('항목을 찾을 수 없어요');

function readAll(): Asset[] {
  return safeRead<Asset[]>(KEY, []);
}

/** name/amount 검증 순서: 빈값/amount<1 → 길이(20자) → 금액 상한 */
function validateNameAmount(name: string, amount: number): string | null {
  const trimmed = name.trim();
  if (trimmed === '' || amount < AMOUNT_MIN) return NAME_AMOUNT_ERROR;
  if (trimmed.length > 20) return NAME_LENGTH_ERROR;
  if (amount > AMOUNT_MAX) return AMOUNT_MAX_ERROR;
  return null;
}

export function listAssets(): Asset[] {
  return readAll();
}

export function getAsset(id: string): Asset | null {
  return readAll().find((asset) => asset.id === id) ?? null;
}

export function createAsset(input: AssetInput): Result<Asset> {
  const validationError = validateNameAmount(input.name, input.amount);
  if (validationError) return { ok: false, error: validationError };

  const assets = readAll();
  if (assets.length >= ASSET_MAX_COUNT) {
    return { ok: false, error: MAX_COUNT_ERROR };
  }

  const now = nowISO();
  const asset: Asset = {
    id: uid(),
    name: input.name.trim(),
    category: input.category,
    amount: input.amount,
    memo: input.memo ?? '',
    createdAt: now,
    updatedAt: now,
  };

  const writeResult = safeWrite(KEY, [...assets, asset]);
  if (!writeResult.ok) return { ok: false, error: writeResult.error };

  return { ok: true, data: asset };
}

export function updateAsset(id: string, patch: Partial<AssetInput>): Result<Asset> {
  const assets = readAll();
  const index = assets.findIndex((asset) => asset.id === id);
  if (index === -1) return { ok: false, error: NOT_FOUND_ERROR };

  const current = assets[index];
  const nextName = patch.name !== undefined ? patch.name.trim() : current.name;
  const nextAmount = patch.amount !== undefined ? patch.amount : current.amount;

  const validationError = validateNameAmount(nextName, nextAmount);
  if (validationError) return { ok: false, error: validationError };

  const updated: Asset = {
    ...current,
    ...patch,
    name: nextName,
    amount: nextAmount,
    updatedAt: nowISO(),
  };

  const next = [...assets];
  next[index] = updated;

  const writeResult = safeWrite(KEY, next);
  if (!writeResult.ok) return { ok: false, error: writeResult.error };

  return { ok: true, data: updated };
}

export function deleteAsset(id: string): Result<{ id: string }> {
  const assets = readAll();
  const index = assets.findIndex((asset) => asset.id === id);
  if (index === -1) return { ok: false, error: NOT_FOUND_ERROR };

  const next = assets.filter((asset) => asset.id !== id);
  const writeResult = safeWrite(KEY, next);
  if (!writeResult.ok) return { ok: false, error: writeResult.error };

  return { ok: true, data: { id } };
}
