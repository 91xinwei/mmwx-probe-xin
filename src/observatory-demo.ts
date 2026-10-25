import type { ProbePayload } from "./types";
import { CARRIERS } from "./observatory-data";
const G = 1024 ** 3;
export const demo: ProbePayload = {
  enabled: true,
  title: "Xin Observatory",
  history_days: 7,
  tri_isp: {
    enabled: true,
    targets: CARRIERS.map((c) => ({
      isp: c.isp,
      key: `sh-${c.isp}`,
      label: c.label,
    })),
  },
  servers: [
    "BWG · 洛杉矶",
    "DMIT · 洛杉矶",
    "VMISS · 东京",
    "V.PS · 伦敦",
    "BERO · 法兰克福",
    "Osaka · 大阪",
  ].map((name, i) => ({
    name,
    online: i !== 5,
    region: ["🇺🇸", "🇺🇸", "🇯🇵", "🇬🇧", "🇩🇪", "🇯🇵"][i],
    region_name: ["美国", "美国", "日本", "英国", "德国", "日本"][i],
    region_city: ["洛杉矶", "洛杉矶", "东京", "伦敦", "法兰克福", "大阪"][i],
    provider_name: ["Bandwagon", "DMIT", "VMISS", "V.PS", "BERO", "Vultr"][i],
    cpu_pct: [24.8, 12.3, 48.6, 8.2, 93.1, 0][i],
    cpu_cores: 2,
    mem_used: [1.8, 2.4, 3.1, 1.1, 2.2, 1.4][i] * G,
    mem_total: 4 * G,
    disk_used: 18 * G,
    disk_total: 80 * G,
    download_speed: (i + 1) * 1234567,
    upload_speed: (i + 1) * 612345,
    traffic_used: (i + 1) * 78 * G,
    traffic_limit: i === 3 ? 0 : 1000 * G,
    traffic_source: "xray",
    traffic_stats_mode: "both",
    period_start: "2026-10-01",
    period_end: "2026-11-01",
    daily_traffic: Array.from({ length: 7 }, (_, j) => ({
      date: `2026-10-${19 + j}`,
      uplink: ((i + 2) * (j + 1) * G) / 4,
      downlink: ((i + 2) * [3, 5, 4, 7, 6, 4, 2][j] * G) / 4,
      total: ((i + 2) * (j + 1 + [3, 5, 4, 7, 6, 4, 2][j]) * G) / 4,
    })),
    os: "Debian 12",
    arch: "x86_64",
    uptime: (i + 4) * 86400,
    last_seen: i === 5 ? "2026-10-25T04:00:00Z" : undefined,
    tcp_connections: 123 + i * 37,
    conn_history: {
      tcp: Array.from({ length: 12 }, (_, j) => 100 + i * 35 + j * 4),
      udp: Array.from({ length: 12 }, (_, j) => 20 + i * 3 + j),
    },
    udp_connections: 23 + i * 4,
    return_routes: CARRIERS.map((c) => ({
      carrier: c.isp,
      route_type: "普通线路",
      region: "上海",
      tested_at: "2026-10-25T05:00:00Z",
    })),
    unlocks: [
      {
        service: "netflix",
        status: "yes",
        region: "US",
        tested_at: "2026-10-25T05:00:00Z",
      },
    ],
    ping: CARRIERS.flatMap((c, k) =>
      [false, true].map((v6) => ({
        key: `sh-${c.isp}${v6 ? "-v6" : ""}`,
        label: `${c.label}${v6 ? " IPv6" : ""}`,
        isp: c.isp,
        current_ms: [136, 141, 52, 191, 178, -1][i] + k * 5 + (v6 ? 7 : 0),
        loss_pct: i === 2 && k === 1 ? 9.09 : k / 10,
        buckets: Array.from({ length: 12 }, (_, j) => ({
          ms:
            i === 5
              ? -1
              : [130, 138, 45, 185, 172][i] + ((j * 7 + k * 11) % 25),
          loss: i === 2 && k === 1 && j > 7 ? 12 : 0,
        })),
      })),
    ),
  })),
};
