import type { ProbePayload, ProbePingSeries, ProbeServer } from "./types";
import { billableTraffic } from "./traffic-display";
import { probeHealthIssue } from "./probe-overview";
export const CARRIERS = [
  { isp: "telecom", label: "上海电信", color: "#ba8d36" },
  { isp: "unicom", label: "上海联通", color: "#5a87bd" },
  { isp: "mobile", label: "上海移动", color: "#55a28b" },
] as const;
export type IPFamily = "IPv4" | "IPv6";
export function shanghaiRows(
  server: ProbeServer,
  data: ProbePayload,
  family: IPFamily,
) {
  return CARRIERS.map((carrier) => {
    const matches = (p: { label?: string; key?: string; isp?: string }) =>
      /上海|shanghai/i.test(p.label ?? "") &&
      (p.isp === carrier.isp || (p.label ?? "").includes(carrier.label)) &&
      /ipv6|\bv6\b/i.test(`${p.label} ${p.key}`) === (family === "IPv6");
    const configured = data.tri_isp?.targets?.find(matches);
    const series = configured
      ? server.ping?.find((p) => p.key === configured.key)
      : server.ping?.find(matches);
    return { ...carrier, series: server.online ? series : undefined };
  });
}
export function networkIssue(server: ProbeServer, data: ProbePayload) {
  if (!server.online) return false;
  return (["IPv4", "IPv6"] as const).some((family) =>
    shanghaiRows(server, data, family).some(
      (r) => r.series && (r.series.loss_pct > 1 || r.series.loss_pct === 100),
    ),
  );
}
export function hasIssue(server: ProbeServer, data: ProbePayload) {
  return (
    !!probeHealthIssue(server, billableTraffic(server)) ||
    networkIssue(server, data)
  );
}
export function sevenDayTraffic(servers: ProbeServer[]) {
  const totals = new Map<string, number>();
  for (const s of servers)
    for (const row of s.daily_traffic ?? [])
      totals.set(row.date, (totals.get(row.date) ?? 0) + row.total);
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, total]) => ({ date, total }));
}
export function validMetric(n?: number) {
  return n !== undefined && Number.isFinite(n) && n >= 0;
}
export function latency(p?: ProbePingSeries) {
  return validMetric(p?.current_ms) ? `${p!.current_ms.toFixed(0)} ms` : "—";
}
export function loss(p?: ProbePingSeries) {
  return validMetric(p?.loss_pct) ? `${p!.loss_pct.toFixed(2)}%` : "—";
}
export function safeLink(url?: string) {
  try {
    const u = new URL(url ?? "");
    return /^https?:$/.test(u.protocol) && !u.username && !u.password
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function regionLabel(server: ProbeServer): string {
  const country = server.region_country?.trim();
  if (country && /^[A-Za-z]{2}$/.test(country)) {
    try {
      return (
        new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(
          country.toUpperCase(),
        ) ?? country
      );
    } catch {
      return country;
    }
  }
  return country || server.region_name || "未设置地区";
}
export function formatBytes(value?: number): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) return "—";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.max(
    0,
    Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024))),
  );
  return `${Number((value / 1024 ** index).toFixed(1))} ${units[index]}`;
}
export function networkIssueLabel(
  server: ProbeServer,
  data: ProbePayload,
): string {
  return (["IPv4", "IPv6"] as const)
    .filter((family) =>
      shanghaiRows(server, data, family).some(
        (row) => (row.series?.loss_pct ?? 0) > 1,
      ),
    )
    .map((family) => `${family} 三网丢包 >1%`)
    .join(" · ");
}
