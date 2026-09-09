import { Paragraph } from "@toss/tds-mobile";
import type { NetWorthSnapshot } from "@/lib/types";
import { formatCompactKRW } from "@/lib/format";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 160;
const PAD_X = 12;
const PAD_Y = 12;
const POINT_RADIUS = 3;

function monthLabel(month: string): string {
  const parts = month.split("-");
  return parts.length === 2 ? `${Number(parts[1])}월` : month;
}

/**
 * 순자산 추이 라인차트 — 뷰포트 폭 반응형 SVG(viewBox 기반).
 *
 * 커스텀 SVG는 SPEC이 허용한 예외(차트 렌더링). 데이터 0개면 null을 반환하니
 * 부모가 EmptyState(StateView)로 대체 렌더할 것.
 */
export function NetWorthChart({ data }: { data: NetWorthSnapshot[] }) {
  if (!data || data.length === 0) return null;

  const values = data.map((d) => d.netWorth);
  const domainMin = Math.min(...values);
  const domainMax = Math.max(...values);
  const isFlat = domainMax === domainMin;
  const span = isFlat ? 1 : domainMax - domainMin;
  const hasNegative = domainMin < 0;

  const plotTop = PAD_Y;
  const plotBottom = VIEW_HEIGHT - PAD_Y;
  const centerY = (plotTop + plotBottom) / 2;

  const yFor = (value: number): number => {
    if (isFlat) return centerY;
    return plotBottom - ((value - domainMin) / span) * (plotBottom - plotTop);
  };

  const xFor = (index: number): number => {
    if (data.length === 1) return VIEW_WIDTH / 2;
    return PAD_X + (index / (data.length - 1)) * (VIEW_WIDTH - PAD_X * 2);
  };

  const coords = data.map((d, i) => ({ x: xFor(i), y: yFor(d.netWorth) }));
  const linePath =
    coords.length >= 2
      ? coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      : "";
  const zeroY = yFor(0);

  return (
    <div style={{ width: "100%" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label="순자산 추이 그래프"
      >
        {hasNegative && (
          <line
            data-testid="chart-zero-line"
            x1={PAD_X}
            x2={VIEW_WIDTH - PAD_X}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--tds-color-grey300)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {linePath && (
          <path
            data-testid="chart-line"
            d={linePath}
            fill="none"
            stroke="var(--tds-color-blue500)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {coords.map((p, i) => (
          <circle
            key={data[i].month}
            data-testid="chart-point"
            cx={p.x}
            cy={p.y}
            r={POINT_RADIUS}
            fill="var(--tds-color-blue500)"
          />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Paragraph.Text typography="st11" color="var(--tds-color-grey500)">
          {monthLabel(data[0].month)} · {formatCompactKRW(data[0].netWorth)}
        </Paragraph.Text>
        <Paragraph.Text typography="st11" color="var(--tds-color-grey500)">
          {monthLabel(data[data.length - 1].month)} · {formatCompactKRW(data[data.length - 1].netWorth)}
        </Paragraph.Text>
      </div>
    </div>
  );
}
