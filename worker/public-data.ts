// Public data is a projection, never a copy of the upstream response. New fields
// (including costs and addresses) stay private until explicitly reviewed here.
type Shape = true | { [key: string]: Shape } | readonly [Shape];
const bucket = { ms: true, loss: true } as const;
const point = { t: true, value: true } as const;
const ping = {
  key: true,
  label: true,
  isp: true,
  current_ms: true,
  loss_pct: true,
  tri_fallback: true,
  buckets: [bucket],
} as const;
const server = Object.fromEntries(
  `name region region_country region_name region_city online last_seen upload_speed download_speed traffic_used traffic_used_up traffic_used_down traffic_used_total traffic_limit traffic_source traffic_stats_mode traffic_adjustment traffic_used_scope period_start period_end daily_traffic_scope daily_traffic_start daily_traffic_end boot_traffic_up boot_traffic_down boot_traffic_scope cumulative_up cumulative_down cumulative_traffic_scope cpu_pct loadavg mem_used mem_total disk_used disk_total uptime cpu_model cpu_cores cpu_threads os kernel arch tcp_connections udp_connections provider_name provider_url telecom_paid_peer`
    .split(" ")
    .map((k) => [k, true]),
) as Record<string, Shape>;
Object.assign(server, {
  daily_traffic: [{ date: true, uplink: true, downlink: true, total: true }],
  conn_history: { tcp: [true], udp: [true] },
  ping: [ping],
  return_routes: [
    { carrier: true, region: true, route_type: true, tested_at: true },
  ],
  unlocks: [{ service: true, status: true, region: true, tested_at: true }],
});
const forward = {
  name: true,
  end_to_end_ms: true,
  loss_pct: true,
  route_hop: true,
  route_policy: true,
  failover_ms: true,
  availability_24h: true,
  jitter_ms: true,
  speed_up: true,
  speed_down: true,
  cells: true,
  bucket_sec: true,
  trend: [{ ts: true, e2e_ms: true, loss: true }],
  routes: [
    {
      name: true,
      via: [true],
      latency_ms: true,
      loss_pct: true,
      selected: true,
      selected_by: [true],
    },
  ],
  groups: [
    {
      name: true,
      role: true,
      to_next_ms: true,
      loss_pct: true,
      servers: [
        {
          name: true,
          to_next_ms: true,
          healthy: true,
          loss_pct: true,
          route: true,
        },
      ],
    },
  ],
  traffic: {
    days: [true],
    total_gb: true,
    servers: [
      { name: true, group: true, role: true, daily_gb: [true], total_gb: true },
    ],
  },
} as const;
const snapshot = {
  enabled: true,
  title: true,
  logo: true,
  icon: true,
  block_login: true,
  show_name: true,
  show_forward: true,
  appearance: { theme: true, color_mode: true, revision: true },
  license_badge: { name: true, display_name: true },
  ...Object.fromEntries(
    `show_globe show_daily_trend show_traffic_hotspots show_traffic_7d show_resource_heatmap show_traffic_quota show_health_score history_days`
      .split(" ")
      .map((k) => [k, true as const]),
  ),
  tri_isp: { enabled: true, targets: [{ isp: true, key: true, label: true }] },
  servers: [server],
  forward: [forward],
} satisfies Shape;
const metricSeries = Object.fromEntries(
  `cpu_pct mem_used mem_total disk_used disk_total upload_speed download_speed cumulative_up cumulative_down tcp_connections udp_connections`
    .split(" ")
    .map((k) => [k, [point]]),
) as Record<string, Shape>;
const history = {
  success: true,
  bucket_sec: true,
  generated_at: true,
  buckets: true,
  series: ping,
  all_series: [ping],
} as const;
export function project(value: unknown, shape: Shape): unknown {
  if (value === null) return null;
  if (shape === true)
    return ["string", "number", "boolean"].includes(typeof value)
      ? value
      : undefined;
  if (Array.isArray(shape))
    return Array.isArray(value)
      ? value
          .map((item) => project(item, shape[0]))
          .filter((v) => v !== undefined)
      : undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(shape)) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const next = project((value as Record<string, unknown>)[key], child);
      if (next !== undefined) output[key] = next;
    }
  }
  return output;
}
export function publicSnapshot(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { enabled?: unknown }).enabled !== "boolean"
  )
    throw new Error("Invalid probe snapshot");
  if (!(value as { enabled: boolean }).enabled) return { enabled: false };
  return project(value, snapshot) as Record<string, unknown>;
}
export function publicResponse(
  path: string,
  value: unknown,
  metric?: string | null,
): unknown {
  if (path === "/api/probe") return publicSnapshot(value);
  if (path === "/api/forward")
    return project(value, {
      success: true,
      enabled: true,
      generated_at: true,
      chains: [forward],
      forward: [forward],
    });
  if (path === "/api/series")
    return project(
      value,
      metric === "system" ? { ...history, series: metricSeries } : history,
    );
  throw new Error("Unknown public endpoint");
}
export function publicFrame(frame: unknown): string {
  if (typeof frame !== "string") throw new Error("Invalid snapshot frame");
  return JSON.stringify(publicSnapshot(JSON.parse(frame)));
}
