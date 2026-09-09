// TDD RED phase — stub only, no implementation yet

export type AssetCategory = "deposit" | "investment" | "debt" | "property" | "other";

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  amount: number;
  memo: string;
  createdAt: number;
  updatedAt: number;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function listAssets(): Asset[] {
  throw new Error("Not implemented");
}

export function createAsset(input: {
  name: string;
  category: AssetCategory;
  amount: number;
  memo: string;
}): Result<Asset> {
  throw new Error("Not implemented");
}

export function updateAsset(
  id: string,
  patch: Partial<Omit<Asset, "id" | "createdAt">>
): Result<Asset> {
  throw new Error("Not implemented");
}

export function deleteAsset(id: string): Result<{ id: string }> {
  throw new Error("Not implemented");
}

export function getAsset(id: string): Asset | null {
  throw new Error("Not implemented");
}
