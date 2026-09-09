// 금액 포맷 유틸 (순수 함수)

function formatThousands(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatKRW(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatThousands(Math.abs(amount))}원`;
}

export function formatCompactKRW(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs === 0) return "0원";

  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);

  if (eok > 0) {
    return man > 0
      ? `${sign}${eok}억 ${formatThousands(man)}만원`
      : `${sign}${eok}억원`;
  }
  if (man > 0) {
    return `${sign}${formatThousands(man)}만원`;
  }
  return formatKRW(amount);
}

export function formatSignedKRW(amount: number): string {
  if (amount === 0) return "0원";
  const sign = amount > 0 ? "+" : "-";
  return `${sign}${formatThousands(Math.abs(amount))}원`;
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${str}%`;
}

/**
 * 비율 포맷팅 — contract.ts formatPercentageFn 계약.
 * decimals(기본 1자리) 반올림 + showSign 옵션(양수에 + 부호) 지원.
 */
export function formatPercentage(
  rate: number,
  opts?: { decimals?: number; showSign?: boolean }
): string {
  const decimals = opts?.decimals ?? 1;
  const factor = 10 ** decimals;
  const rounded = Math.round(rate * factor) / factor;
  const sign = opts?.showSign && rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}
