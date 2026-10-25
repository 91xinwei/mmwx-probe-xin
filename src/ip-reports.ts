export type IPProvider = "iplense" | "ip2location" | "ippure" | "netcoffee";
export interface IPReport {
  id: string;
  ip: string;
  source: IPProvider;
  source_name: string;
  report_url: string;
  observed_at: string;
  collection: "page_snapshot" | "api";
  node_names?: string[];
  geography?: string;
  registration_country?: string;
  asn?: string;
  organization?: string;
  network?: string;
  tags?: string[];
  is_proxy?: boolean;
  metrics: {
    label: string;
    value: number;
    maximum: number;
    direction: "higher_is_better" | "lower_is_better";
    description?: string;
  }[];
  asn_traffic?: { human: number; automated: number };
  refresh_status?: "ok" | "failed";
}
export interface IPReportPayload {
  reports: IPReport[];
}
export const reportSources = [
  {
    id: "iplense",
    name: "IPLense",
    url: "https://iplense.cc/",
    description: "综合评分 · 纯净度风险 · 网络属性",
  },
  {
    id: "ip2location",
    name: "IP2Location.io",
    url: "https://www.ip2location.io/",
    description: "归属地 · ASN · 代理标记",
  },
  {
    id: "ippure",
    name: "IPPure",
    url: "https://ippure.com/",
    description: "风险系数 · 原生与住宅属性",
  },
  {
    id: "netcoffee",
    name: "Net.Coffee",
    url: "https://ip.net.coffee/ip/",
    description: "多源 IP 信息与评分查询",
  },
] as const;
const sourceHosts: Record<IPProvider, string[]> = {
  iplense: ["iplense.cc"],
  ip2location: ["www.ip2location.io", "ip2location.io"],
  ippure: ["ippure.com"],
  netcoffee: ["ip.net.coffee"],
};
export function reportLink(
  report: Pick<IPReport, "source" | "report_url">,
): string | undefined {
  try {
    const url = new URL(report.report_url);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      sourceHosts[report.source]?.includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function metricText(metric: IPReport["metrics"][number]) {
  return Number.isFinite(metric.maximum) &&
    metric.maximum > 0 &&
    Number.isFinite(metric.value) &&
    metric.value >= 0 &&
    metric.value <= metric.maximum
    ? `${metric.value} / ${metric.maximum}`
    : "未获取";
}
export function linkedReports(reports: IPReport[], nodeName?: string) {
  return nodeName === undefined
    ? reports
    : reports.filter(
        (r) => nodeName.length > 0 && r.node_names?.includes(nodeName),
      );
}
export function reportAge(report: IPReport, now = Date.now()) {
  const date = Date.parse(report.observed_at);
  return Number.isFinite(date) ? now - date : undefined;
}
