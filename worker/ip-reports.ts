import { ipinfoReport, ipinfoURL } from "./ipinfo";
import snapshot from "../src/data/ip-reports.json";
import type { IPReport, IPReportPayload } from "../src/ip-reports";
// Only explicitly published report IPs may be looked up. Never create a general
// arbitrary-target proxy or guess a node's exit address from its display name.
const stored = snapshot.reports as IPReport[];
export const publishedIPs = [...new Set(stored.map((r) => r.ip))];
export function ip2LocationReport(
  ip: string,
  input: unknown,
  observedAt: string,
): IPReport {
  if (!input || typeof input !== "object") throw new Error("Invalid report");
  const value = input as Record<string, unknown>;
  if (value.ip !== ip || value.error)
    throw new Error("Mismatched or unavailable IP");
  const text = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string) : undefined;
  const asn =
    text("asn") ??
    (typeof value.asn === "number" ? String(value.asn) : undefined);
  const fraud = value.fraud_score;
  return {
    id: `ip2location-${ip}`,
    ip,
    source: "ip2location",
    source_name: "IP2Location.io",
    report_url: `https://www.ip2location.io/${encodeURIComponent(ip)}`,
    observed_at: observedAt,
    collection: "api",
    geography:
      [text("country_name"), text("region_name"), text("city_name")]
        .filter(Boolean)
        .join(" · ") || undefined,
    asn: asn ? `AS${asn.replace(/^AS/i, "")}` : undefined,
    organization: text("as"),
    is_proxy: typeof value.is_proxy === "boolean" ? value.is_proxy : undefined,
    metrics:
      typeof fraud === "number" &&
      Number.isFinite(fraud) &&
      fraud >= 0 &&
      fraud <= 99
        ? [
            {
              label: "欺诈风险分",
              value: fraud,
              maximum: 99,
              direction: "lower_is_better",
            },
          ]
        : [],
    refresh_status: "ok",
  };
}
// Website endpoint used by Net.Coffee's Claude page; not a versioned API.
export function netCoffeeReport(ip: string, input: unknown, observedAt: string): IPReport {
  if (!input || typeof input !== "object") throw new Error("Invalid Net.Coffee report");
  const v = input as Record<string, unknown>;
  if (v.ip !== ip) throw new Error("来源返回不同 IP，未采用其评分");
  if (v.error) throw new Error("Net.Coffee 返回错误");
  const text = (key: string) => typeof v[key] === "string" && v[key] ? v[key] as string : undefined;
  const checks = [
    ["isResidential", "住宅属性"], ["isBroadcast", "广播属性"],
    ["is_datacenter", "数据中心"], ["is_vpn", "VPN"], ["is_proxy", "代理"],
    ["is_tor", "Tor"], ["is_crawler", "爬虫"], ["is_abuser", "滥用记录"], ["is_mobile", "移动网络"],
  ];
  const attributes = checks.map(([key, label]) => ({label, value: typeof v[key] === "boolean" ? (v[key] ? "是" : "否") : "未提供"}));
  for (const [key,label] of [["timezone","IP 时区"],["company_type","机构类型"],["datacenter_name","数据中心名称"],["abuser_score","来源滥用指标"],["rdns","反向 DNS"],["rpki_status","RPKI 状态"]]) {
    const value = text(key); if (value) attributes.push({label,value});
  }
  const score = v.trust_score;
  return {
    id: `netcoffee-${ip}`, ip, source: "netcoffee", source_name: "Net.Coffee · Claude IP",
    report_url: "https://ip.net.coffee/claude/", observed_at: observedAt, collection: "api",
    geography: [text("country"),text("region"),text("city")].filter(Boolean).join(" · ") || undefined,
    asn: typeof v.asn === "number" && Number.isFinite(v.asn) ? `AS${v.asn}` : text("asn"),
    organization: text("asOrganization") ?? text("company_name"), network: text("cidr"),
    is_proxy: typeof v.is_proxy === "boolean" ? v.is_proxy : undefined,
    attributes,
    metrics: typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100
      ? [{label:"Claude IP 信任分",value:score,maximum:100,direction:"higher_is_better",description:"Net.Coffee 评分，不代表 Anthropic 官方评估或可用性保证。"}] : [],
    refresh_status:"ok",
  };
}
export async function loadIPReports(
  lookup: (ip: string) => Promise<unknown>,
  now = () => new Date().toISOString(),
  lookupNetCoffee?: (ip: string) => Promise<unknown>,
  lookupIPinfo?: (ip: string) => Promise<unknown>,
): Promise<IPReportPayload> {
  const refreshed = await Promise.all(
    publishedIPs.map(async (ip) => {
      try {
        const report = ip2LocationReport(ip, await lookup(ip), now());
        const names = [
          ...new Set(
            stored
              .filter((r) => r.ip === ip)
              .flatMap((r) => r.node_names ?? []),
          ),
        ];
        return names.length ? { ...report, node_names: names } : report;
      } catch {
        const fallback = stored.find(
          (r) => r.source === "ip2location" && r.ip === ip,
        );
        return fallback
          ? { ...fallback, refresh_status: "failed" as const }
          : null;
      }
    }),
  );
  const coffee = lookupNetCoffee ? await Promise.all(publishedIPs.map(async (ip) => {
    const node_names = [...new Set(stored.filter(r => r.ip === ip).flatMap(r => r.node_names ?? []))];
    try {
      return {...netCoffeeReport(ip, await lookupNetCoffee(ip), now()), node_names};
    } catch (error) {
      const refresh_error = error instanceof Error && error.message === "来源返回不同 IP，未采用其评分" ? error.message : "来源查询失败，稍后重试";
      const fallback = stored.find(r => r.ip === ip && r.source === "netcoffee");
      return fallback ? {...fallback, refresh_status:"failed" as const, refresh_error} : {
        id:`netcoffee-${ip}`, ip, source:"netcoffee" as const, source_name:"Net.Coffee · Claude IP",
        report_url:"https://ip.net.coffee/claude/", observed_at:"", collection:"api" as const,
        node_names, metrics:[], refresh_status:"failed" as const, refresh_error,
      };
    }
  })) : [];
  const info = lookupIPinfo ? await Promise.all(publishedIPs.map(async (ip): Promise<IPReport | null> => {
    const node_names = [...new Set(stored.filter(r => r.ip === ip).flatMap(r => r.node_names ?? []))];
    try { return {...ipinfoReport(ip,await lookupIPinfo(ip),now()),node_names}; }
    catch { const old=stored.find(r=>r.source==="ipinfo" && r.ip===ip); return old ? {...old,refresh_status:"failed" as const} : null; }
  })) : [];
  return {
    reports: [
      ...info.filter((r): r is IPReport => r !== null),
      ...stored.filter((r) => r.source !== "ip2location" && (!lookupIPinfo || r.source !== "ipinfo") && (!lookupNetCoffee || r.source !== "netcoffee")),
      ...coffee,
      ...refreshed.filter((report): report is IPReport => report !== null),
    ],
  };
}
export async function ipReportsResponse(
  request: Request,
  key?: string,
  ipinfoToken?: string,
): Promise<Response> {
  const url = new URL("/__report-cache/v4", request.url);
  const cacheRequest = new Request(url);
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache.match(cacheRequest);
  if (cached) return cached;
  const payload = await loadIPReports(async (ip) => {
    const url = new URL("https://api.ip2location.io/");
    url.searchParams.set("ip", ip);
    const response = await fetch(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Report unavailable");
    return response.json();
  }, undefined, async (ip) => {
    const response = await fetch(`https://ip.net.coffee/api/iprisk/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(12000), headers: { Accept:"application/json" },
    });
    if (!response.ok) throw new Error("Net.Coffee unavailable");
    return response.json();
  }, async ip => {
    const response=await fetch(ipinfoURL(ip,ipinfoToken),{headers:ipinfoToken?{Authorization:`Bearer ${ipinfoToken}`}:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw Error("IPinfo unavailable");
    return response.json();
  });
  const response = Response.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
  await cache.put(cacheRequest, response.clone());
  return response;
}
