import type { ProbePingSeries } from "./types";
export function SeriesChart({
  rows,
  unit = "ms",
  maxValue,
  label = "趋势图",
}: {
  rows: Array<{ label: string; color: string; values: (number | null)[] }>;
  unit?: string;
  maxValue?: number;
  label?: string;
}) {
  const maximum =
    maxValue ??
    Math.max(
      1,
      ...rows.flatMap((r) => r.values.map((v) => (v === null ? 0 : v))),
    );
  const count = Math.max(2, ...rows.map((r) => r.values.length));
  const segments = (values: (number | null)[]) => {
    const out: string[] = [];
    let part: string[] = [];
    values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v) || v < 0) {
        if (part.length) out.push(part.join(" "));
        part = [];
      } else
        part.push(
          `${45 + (i / (count - 1)) * 690},${170 - (Math.min(v, maximum) / maximum) * 140}`,
        );
    });
    if (part.length) out.push(part.join(" "));
    return out;
  };
  if (!rows.some((r) => r.values.some((v) => v !== null && v >= 0)))
    return <div className="ob-empty">该时间范围没有可用样本</div>;
  return (
    <div className="ob-line-chart">
      <svg
        viewBox="0 0 760 200"
        role="img"
        aria-label={`${label}，纵轴 ${unit}，横轴从较早到最近`}
      >
        <title>
          {label}，纵轴 {unit}
        </title>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="45"
              x2="735"
              y1={170 - v * 140}
              y2={170 - v * 140}
              stroke="currentColor"
              opacity=".12"
            />
            <text x="0" y={174 - v * 140} fill="currentColor" fontSize="11">
              {Math.round(v * maximum)}
            </text>
          </g>
        ))}
        {rows.flatMap((r) =>
          segments(r.values).map((points, i) => (
            <polyline
              key={`${r.label}-${i}`}
              points={points}
              fill="none"
              stroke={r.color}
              strokeWidth="2.5"
            />
          )),
        )}
        <text x="45" y="195" fill="currentColor" fontSize="11">
          较早
        </text>
        <text x="708" y="195" fill="currentColor" fontSize="11">
          最近
        </text>
      </svg>
      <div className="ob-chart-legend">
        {rows.map((r) => (
          <span key={r.label}>
            <i style={{ background: r.color }} />
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
export function PingChart({
  rows,
}: {
  rows: Array<{ label: string; color: string; series?: ProbePingSeries }>;
}) {
  return (
    <SeriesChart
      label="三网延迟趋势"
      rows={rows.map((r) => ({
        ...r,
        values: r.series?.buckets?.map((b) => (b.ms < 0 ? null : b.ms)) ?? [],
      }))}
    />
  );
}
