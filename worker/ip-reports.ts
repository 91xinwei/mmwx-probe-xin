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
export async function loadIPReports(
  lookup: (ip: string) => Promise<unknown>,
  now = () => new Date().toISOString(),
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
  return {
    reports: [
      ...stored.filter((r) => r.source !== "ip2location"),
      ...refreshed.filter((report): report is IPReport => report !== null),
    ],
  };
}
export async function ipReportsResponse(
  request: Request,
  key?: string,
): Promise<Response> {
  const url = new URL("/__report-cache/v2", request.url);
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
