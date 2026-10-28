import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Globe2,
  LayoutGrid,
  List,
  Radio,
  Search,
  Server,
  Sun,
  Moon,
  X,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useProbe } from "./use-probe";
import type { ProbePayload, ProbeServer, ProbePingSeries } from "./types";
import {
  formatSize,
  memPct,
  diskPct,
  probeHealthIssue,
  relativeTime,
} from "./probe-overview";
import { billableTraffic, trafficRuleLabel } from "./traffic-display";
import { probeRangeOptions } from "./probe-ranges";
import {
  CARRIERS,
  shanghaiRows,
  networkIssue,
  hasIssue,
  sevenDayTraffic,
  latency,
  loss,
  safeLink,
  regionLabel,
  formatBytes,
  networkIssueLabel,
  type IPFamily,
} from "./observatory-data";
import { demo } from "./observatory-demo";
import { PingChart } from "./ProbeCharts";
import { readOwnerJSON } from "./owner-access";
import { OwnerCosts } from "./OwnerCosts";
import { IPQuality } from "./IPQuality";
import nodeIPMap from "./data/node-ip-map.json";
import { ResourceHistory, UnlockResults } from "./ProbeExtras";
import "./observatory.css";
import "./custom-probe-tech.css";
const RegionGlobe = lazy(() =>
  import("./RegionGlobe").then((m) => ({ default: m.RegionGlobe })),
);
const size = formatBytes;
const pct = (n?: number) => (n === undefined ? "—" : `${n.toFixed(1)}%`);
function Meter({ label, value }: { label: string; value?: number }) {
  return (
    <div className="ob-meter">
      <div>
        <span>{label}</span>
        <b>{pct(value)}</b>
      </div>
      <div className="ob-track">
        <i
          style={{
            width: `${Math.max(0, Math.min(value ?? 0, 100))}%`,
            background: (value ?? 0) > 90 ? "#ce674c" : undefined,
          }}
        />
      </div>
    </div>
  );
}
function TriRows({
  server,
  data,
  family,
}: {
  server: ProbeServer;
  data: ProbePayload;
  family: IPFamily;
}) {
  return (
    <div className="ob-tri">
      <div className="ob-tri-head">
        <span>上海三网 · {family}</span>
        <span>延迟</span>
        <span>近 1h 丢包</span>
        <span>趋势</span>
      </div>
      {shanghaiRows(server, data, family).map((r) => (
        <div className="ob-tri-row" key={r.isp}>
          <span>
            <i style={{ background: r.color }} />
            {r.label}
          </span>
          <b>{latency(r.series)}</b>
          <b className={(r.series?.loss_pct ?? 0) > 1 ? "ob-danger" : ""}>
            {loss(r.series)}
          </b>
          <div className="ob-spark">
            {r.series?.buckets?.map((b, i) => (
              <i
                key={i}
                title={b.ms < 0 ? "无数据" : `${b.ms} ms / 丢包 ${b.loss}%`}
                style={{
                  height:
                    b.ms < 0
                      ? "2px"
                      : `${Math.min(22, Math.max(4, b.ms / 12))}px`,
                  background: b.loss > 1 ? "#ce674c" : r.color,
                  opacity: b.ms < 0 ? 0.15 : 0.7,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function Detail({
  server,
  index,
  data,
  isDemo,
  family,
  onClose,
  initialTab = "network",
}: {
  server: ProbeServer;
  index: number;
  data: ProbePayload;
  isDemo: boolean;
  family: IPFamily;
  onClose: () => void;
  initialTab?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState(initialTab);
  const [range, setRange] = useState("1h");
  const [history, setHistory] = useState<ProbePingSeries[]>();
  const [state, setState] = useState("");
  const rangeOptions = probeRangeOptions(data.history_days);
  const effectiveRange = rangeOptions.some((r) => r.key === range)
    ? range
    : "1h";
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    setHistory(undefined);
    setState("");
    if (isDemo || !server.online) return;
    const controller = new AbortController();
    const load = async () => {
      setState("loading");
      try {
        const params = new URLSearchParams({
          server: String(index),
          all: "1",
          range: effectiveRange,
        });
        const response = await fetch(`/api/series?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const result = (await response.json()) as {
          success?: boolean;
          all_series?: ProbePingSeries[];
          series?: ProbePingSeries;
        };
        if (!result.success) throw new Error();
        setHistory(result.all_series ?? (result.series ? [result.series] : []));
        setState("ok");
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHistory(undefined);
          setState("error");
        }
      }
    };
    void load();
    const timer = window.setInterval(load, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [index, effectiveRange, isDemo, server.online]);
  const rows = shanghaiRows(
    { ...server, ping: history ?? server.ping },
    data,
    family,
  );
  return (
    <dialog
      className="ob-detail"
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ob-detail-inner">
        <button className="ob-close" aria-label="关闭详情" onClick={onClose}>
          <X size={19} />
        </button>
        <div className="ob-eyebrow">NODE DETAILS / {family}</div>
        <h2>
          {server.region} {server.name || "未命名节点"}
        </h2>
        <p className="ob-hint">
          {server.online ? "在线" : "离线"} ·{" "}
          {server.provider_name || "服务商未设置"}
        </p>
        <div className="ob-tabs ob-detail-tabs">
          {[
            ["network", "网络质量"],
            ["resources", "系统资源"],
            ["traffic", "流量"],
            ["unlocks", "解锁检测"],
            ["ip", "IP 质量"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "network" && (
          <>
            <TriRows server={server} data={data} family={family} />
            <div className="ob-range">
              {rangeOptions.map((r) => (
                <button
                  key={r.key}
                  disabled={isDemo && r.key !== "1h"}
                  className={effectiveRange === r.key ? "active" : ""}
                  onClick={() => setRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {state === "loading" ? (
              <div className="ob-empty">加载历史数据…</div>
            ) : state === "error" ? (
              <div className="ob-notice">
                历史数据加载失败，以下仅展示快照近 1 小时样本。
              </div>
            ) : null}
            <PingChart rows={rows} />
            <p className="ob-hint">
              {isDemo ? "演示样本 · " : ""}服务器 →
              上海探测目标；延迟按数据桶聚合，空缺不连线。图表非用户客户端测速。
            </p>
            <h3>丢包时间轴</h3>
            {rows.map((r) => (
              <div className="ob-loss-row" key={r.isp}>
                <span>{r.label}</span>
                <div>
                  {r.series?.buckets?.length ? (
                    r.series.buckets.map((b, i) => (
                      <i
                        key={i}
                        title={b.loss < 0 ? "无数据" : `${b.loss}%`}
                        style={{
                          background:
                            b.loss < 0
                              ? "var(--ob-line)"
                              : b.loss > 1
                                ? "#ce674c"
                                : "#55a28b",
                        }}
                      />
                    ))
                  ) : (
                    <span>无数据</span>
                  )}
                </div>
              </div>
            ))}
            {server.return_routes?.length ? (
              <>
                <h3>三网回程</h3>
                <dl>
                  {server.return_routes.map((r, i) => (
                    <div key={i}>
                      <dt>
                        {CARRIERS.find(
                          (c) => c.isp === r.carrier,
                        )?.label.replace("上海", "") || r.carrier}{" "}
                        · {r.region}
                      </dt>
                      <dd>
                        {r.route_type}
                        {r.tested_at && (
                          <small>
                            检测于{" "}
                            {new Date(r.tested_at).toLocaleString("zh-CN")}
                          </small>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
          </>
        )}
        {tab === "resources" && (
          <>
            <ResourceHistory
              server={server}
              index={index}
              isDemo={isDemo}
              historyDays={data.history_days}
            />
            <dl>
              {[
                ["操作系统", server.os],
                ["架构", server.arch],
                ["内核", server.kernel],
                [
                  "CPU",
                  server.cpu_model ??
                    (server.cpu_cores ? `${server.cpu_cores} vCPU` : "—"),
                ],
                ["内存容量", size(server.mem_total)],
                ["磁盘容量", size(server.disk_total)],
                ["CPU 核心 / 线程", `${server.cpu_cores ?? "—"} / ${server.cpu_threads ?? "—"}`],
                ["系统负载", server.online ? server.loadavg : "—"],
                ["内存已用", server.online ? size(server.mem_used) : "—"],
                ["磁盘已用", server.online ? size(server.disk_used) : "—"],
                ["到期日期", server.expires_at],
                [
                  "TCP / UDP",
                  server.online
                    ? `${server.tcp_connections ?? "—"} / ${server.udp_connections ?? "—"}`
                    : "—",
                ],
                [
                  "在线时长",
                  server.online && server.uptime !== undefined
                    ? `${Math.floor(server.uptime / 86400)} 天`
                    : "—",
                ],
                [
                  "最后在线",
                  !server.online && server.last_seen
                    ? relativeTime(server.last_seen)
                    : "—",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {tab === "traffic" && (
          <>
            <dl>
              {[
                [
                  "计费用量",
                  `${size(billableTraffic(server))} / ${server.traffic_limit === 0 ? "不限" : size(server.traffic_limit)}`,
                ],
                ["统计规则", trafficRuleLabel(server)],
                ["周期开始", server.period_start ?? "—"],
                ["下一重置日", server.period_end ?? "—"],
                ["实际上行", size(server.traffic_used_up)],
                ["实际下行", size(server.traffic_used_down)],
                ["实际合计", size(server.traffic_used_total)],
                ["本次启动上行", size(server.boot_traffic_up ?? server.cumulative_up)],
                ["本次启动下行", size(server.boot_traffic_down ?? server.cumulative_down)],
                ["计量来源", server.traffic_source ?? "—"],
                ["用量范围", server.traffic_used_scope ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <h3>每日原始流量</h3>
            {server.daily_traffic?.length ? (
              <div className="ob-table-scroll">
                <table className="ob-cost-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>上行</th>
                      <th>下行</th>
                      <th>合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {server.daily_traffic.map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{size(r.uplink)}</td>
                        <td>{size(r.downlink)}</td>
                        <td>{size(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ob-hint">主控未提供每日流量。</p>
            )}
          </>
        )}
        {tab === "unlocks" && <UnlockResults server={server} />}
        {tab === "network" && (
          <IPQuality nodeName={server.name ?? ""} hideUnlinked />
        )}
        {tab === "ip" && <IPQuality nodeName={server.name ?? ""} />}
        {safeLink(server.provider_url) && (
          <a className="ob-classic-link" href={safeLink(server.provider_url)} target="_blank" rel="noopener noreferrer">服务商网站 <ArrowUpRight size={14} /></a>
        )}
        <a
          className="ob-classic-link"
          href={isDemo ? "?view=classic" : "?view=classic"}
        >
          打开原有完整监控视图 <ArrowUpRight size={14} />
        </a>
      </div>
    </dialog>
  );
}
export function Dashboard({
  data,
  error,
  isDemo = false,
  updatedAt,
  tech = false,
}: {
  data?: ProbePayload;
  error?: string;
  isDemo?: boolean;
  updatedAt?: number;
  tech?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("全部地区");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("default");
  const [list, setList] = useState(false);
  const [dark, setDark] = useState(tech);
  const [spinning, setSpinning] = useState(true);
  const [showGlobe, setShowGlobe] = useState(!tech);
  const [selected, setSelected] = useState<{
    index: number;
    name?: string;
    tab?: string;
  }>();
  const [family, setFamily] = useState<IPFamily>("IPv4");
  const [page, setPage] = useState(
    location.pathname === "/owner"
      ? "costs"
      : new URLSearchParams(location.search).get("tab") === "ip"
        ? "ip"
        : "overview",
  );
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    if (isDemo) return;
    const controller = new AbortController();
    fetch("/api/owner/session", {
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => readOwnerJSON<{owner?:boolean}>(r))
      .then((result) => setOwner(result.owner === true))
      .catch(() => {});
    return () => controller.abort();
  }, [isDemo]);
  const payload = data?.enabled ? data : undefined;
  const servers = payload?.servers ?? [];
  const online = servers.filter((s) => s.online);
  const issues = servers.filter((s) => hasIssue(s, payload!));
  const regions = [...new Set(servers.map(regionLabel))];
  const daily = sevenDayTraffic(servers);
  const latestDay = daily.at(-1);
  const sum = (key: "upload_speed" | "download_speed") => {
    const v = online.flatMap((s) => (s[key] === undefined ? [] : [s[key]!]));
    return v.length ? v.reduce((a, b) => a + b, 0) : undefined;
  };
  const visible = useMemo(
    () =>
      servers
        .map((server, index) => ({ server, index }))
        .filter(
          ({ server: s }) =>
            (s.name ?? "").toLowerCase().includes(query.toLowerCase()) &&
            (region === "全部地区" || regionLabel(s) === region) &&
            (filter === "all" ||
              (filter === "online"
                ? s.online
                : filter === "offline"
                  ? !s.online
                  : hasIssue(s, payload!))),
        )
        .sort((a, b) =>
          sort === "cpu"
            ? (b.server.cpu_pct ?? -1) - (a.server.cpu_pct ?? -1)
            : sort === "name"
              ? (a.server.name ?? "").localeCompare(b.server.name ?? "")
              : 0,
        ),
    [servers, query, region, filter, sort, payload],
  );
  const selectedServer =
    selected && servers[selected.index]?.name === selected.name
      ? servers[selected.index]
      : undefined;
  return (
    <div className={`observatory ob-v2 ${dark ? "ob-dark" : ""}`}>
      <header className="ob-header">
        <a href={isDemo ? "?demo=1" : "/"} className="ob-brand">
          <span className="ob-logo">
            <Activity size={22} />
          </span>
          <b>
            {data?.title || "Xin Observatory"}
            <small>NETWORK / OBSERVATORY</small>
          </b>
        </a>
        <nav>
          <span className="ob-live">
            <i />
            {isDemo
              ? "演示数据"
              : error
                ? "连接中断"
                : data
                  ? "实时监控"
                  : "正在连接"}
          </span>
          <button onClick={() => setDark(!dark)} aria-label="切换明暗主题">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="/owner" title="所有者入口" aria-label="所有者入口">
            <KeyRound size={18} />
          </a>
        </nav>
      </header>
      <main className="ob-main">
        <div className="ob-intro">
          <div className="ob-eyebrow">
            {tech ? "INFRASTRUCTURE / LIVE STATUS" : "YOUR NETWORK, IN FOCUS"}
          </div>
          <div className="ob-title">
            <div>
              <h1>
                {tech ? "服务器监控" : "看见连接的每一面"}
                <span>。</span>
              </h1>
              <p>{tech ? "资源、连接、流量与三网质量，一处查看。" : "上海三网 · 实时资源 · 流量趋势"}</p>
            </div>
            <span className="ob-date">
              {isDemo
                ? "DEMO / 虚构节点与数据"
                : updatedAt
                  ? `最近更新 ${new Date(updatedAt).toLocaleTimeString("zh-CN")}`
                  : "等待数据"}
            </span>
          </div>
        </div>
        <div className="ob-page-nav">
          {[
            ["overview", "节点总览"],
            ["network", "网络质量"],
            ["resources", "资源与流量"],
            ["ip", "IP 质量"],
            ["costs", isDemo ? "成本演示" : owner ? "成本与续费" : "成本与续费 · 仅所有者"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => setPage(key)}
            >
              {label}
            </button>
          ))}
          <a href="?view=classic">
            原有视图 <ArrowUpRight size={12} />
          </a>
        </div>
        {isDemo && (
          <div className="ob-demo-banner">
            演示模式 · 节点、三网指标与成本为虚构数据；IP 报告展示已收录的查询结果。
          </div>
        )}
        {import.meta.env.PROBE_READONLY_PREVIEW && !isDemo && (
          <div className="ob-demo-banner">
            已连接现有公开探针 · 实时只读预览 · 金额已在本地服务端过滤
          </div>
        )}
        {error && (
          <div role="alert" className="ob-notice">
            {data
              ? "连接中断，当前显示上次快照。"
              : `暂时无法获取探针数据（${error}）。`}{" "}
            <a href="?demo=1">查看演示 ↗</a>
          </div>
        )}
        {data && !data.enabled && (
          <div className="ob-notice">主控尚未启用探针展示。</div>
        )}
        {page === "costs" ? (
          <OwnerCosts isDemo={isDemo} />
        ) : page === "ip" ? (
          <IPQuality />
        ) : (
          <>
            <section className="ob-v2-stats">
              {[
                {
                  label: "在线节点",
                  value: payload ? `${online.length} / ${servers.length}` : "—",
                  note: `${regions.length} 个地区`,
                },
                {
                  label: "异常节点",
                  value: payload ? String(issues.length) : "—",
                  note: "资源 >90% 或三网丢包 >1%",
                },
                {
                  label: "实时下行",
                  value: size(sum("download_speed")) + "/s",
                  note: "在线节点速率合计",
                },
                {
                  label: "实时上行",
                  value: size(sum("upload_speed")) + "/s",
                  note: "在线节点速率合计",
                },
                {
                  label: "最新日流量",
                  value: size(latestDay?.total),
                  note: latestDay?.date ?? "尚无日流量数据",
                },
              ].map((s) => (
                <article key={s.label}>
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                  <small>{s.note}</small>
                </article>
              ))}
            </section>
            {page === "overview" && tech && (
              <button className="ob-globe-toggle" onClick={() => setShowGlobe(!showGlobe)} aria-expanded={showGlobe}>
                <Globe2 size={16} /> 全球节点分布 · {regions.length} 个地区
                <span>{showGlobe ? "收起地球与资源总览 −" : "展开地球与资源总览 +"}</span>
              </button>
            )}
            {page === "overview" && showGlobe && (
              <section className="ob-earth-panel">
                <div className="ob-earth-map">
                  <div className="ob-section-title">
                    <h2>
                      <Globe2 size={18} /> 全球节点分布
                    </h2>
                    <button
                      className="ob-spin-toggle"
                      onClick={() => setSpinning(!spinning)}
                      aria-pressed={spinning}
                    >
                      {tech ? (spinning ? "暂停自转" : "开启自转") : "拖动旋转"}
                    </button>
                  </div>
                  <Suspense
                    fallback={<div className="ob-empty">地球加载中…</div>}
                  >
                    <RegionGlobe
                      regions={servers.map((s) => s.region ?? "")}
                      showArcs={false}
                      autoRotate={tech && spinning}
                    />
                  </Suspense>
                  <small>标记按国家或地区聚合，不代表服务器精确位置。</small>
                </div>
                <div className="ob-earth-nodes">
                  <div className="ob-section-title">
                    <h2>节点资源实时状态</h2>
                    <span>
                      {online.length} / {servers.length} 在线
                    </span>
                  </div>
                  <div className="ob-earth-scroll">
                    {servers.map((s, index) => (
                      <button
                        className="ob-earth-node"
                        key={`${index}-${s.name}`}
                        onClick={() => setSelected({ index, name: s.name })}
                      >
                        <div>
                          <strong>
                            {s.region} {s.name || `节点 ${index + 1}`}
                          </strong>
                          <span>{s.online ? "在线" : "离线"}</span>
                        </div>
                        <div className="ob-earth-meters">
                          <Meter
                            label="CPU"
                            value={s.online ? s.cpu_pct : undefined}
                          />
                          <Meter
                            label="内存"
                            value={s.online ? memPct(s) : undefined}
                          />
                        </div>
                      </button>
                    ))}
                    {!servers.length && (
                      <div className="ob-empty">等待节点数据</div>
                    )}
                  </div>
                </div>
              </section>
            )}
            {page === "overview" && (
              <section className="ob-insights">
                <article>
                  <div className="ob-section-title">
                    <h2>
                      <Activity size={17} /> 近 7 日原始流量
                    </h2>
                    <span>上行 + 下行</span>
                  </div>
                  {daily.length ? (
                    <div className="ob-daily-chart">
                      {daily.map((r) => (
                        <div key={r.date} title={`${r.date}: ${size(r.total)}`}>
                          <b>{size(r.total)}</b>
                          <i
                            style={{
                              height: `${Math.max(2, (r.total / Math.max(1, ...daily.map((d) => d.total))) * 64)}px`,
                            }}
                          />
                          <span>{r.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ob-empty">尚无每日流量样本</div>
                  )}
                </article>
                <article>
                  <div className="ob-section-title">
                    <h2>
                      <Globe2 size={17} /> 地区与状态
                    </h2>
                    <span>{regions.length} 个地区</span>
                  </div>
                  <div className="ob-region-tiles">
                    {regions.map((r) => {
                      const group = servers.filter((s) => regionLabel(s) === r);
                      return (
                        <button
                          key={r}
                          onClick={() =>
                            setRegion(region === r ? "全部地区" : r)
                          }
                          className={region === r ? "active" : ""}
                        >
                          <span>
                            {group[0]?.region} {r}
                          </span>
                          <b>
                            {group.filter((s) => s.online).length}
                            <small> / {group.length} 在线</small>
                          </b>
                        </button>
                      );
                    })}
                  </div>
                </article>
              </section>
            )}
            <section className="ob-fleet">
              <div className="ob-section-title">
                <h2>
                  <Server size={18} />
                  {page === "network"
                    ? "上海三网质量对比"
                    : page === "resources"
                      ? "资源与流量"
                      : "服务器节点"}
                  <span>{servers.length}</span>
                </h2>
                <div className="ob-family">
                  {(["IPv4", "IPv6"] as const).map((f) => (
                    <button
                      key={f}
                      className={family === f ? "active" : ""}
                      onClick={() => setFamily(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ob-toolbar">
                <div className="ob-tabs">
                  {[
                    ["all", "全部"],
                    ["online", "在线"],
                    ["offline", "离线"],
                    ["alert", "异常"],
                  ].map(([k, l]) => (
                    <button
                      className={filter === k ? "active" : ""}
                      key={k}
                      onClick={() => setFilter(k)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="ob-tools">
                  <label className="ob-search">
                    <Search size={15} />
                    <input
                      placeholder="搜索节点名称…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="地区筛选"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    {["全部地区", ...regions].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    aria-label="排序"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="default">默认排序</option>
                    <option value="cpu">CPU 占用</option>
                    <option value="name">名称排序</option>
                  </select>
                  <button
                    onClick={() => setList(!list)}
                    aria-label="切换卡片或列表"
                  >
                    {list ? <LayoutGrid size={17} /> : <List size={17} />}
                  </button>
                </div>
              </div>
              <p className="ob-measure-note">
                服务器 → 上海探测目标 · 延迟为当前摘要，丢包为近 1 小时摘要 ·
                无数据不记为 0 · {family}
              </p>
              <div
                className={`ob-grid ${list ? "ob-list" : ""} ${page === "network" ? "ob-network-grid" : ""}`}
              >
                {visible.map(({ server: s, index }) => {
                  const used = billableTraffic(s);
                  const limit = s.traffic_limit;
                  const issue = hasIssue(s, payload!);
                  return (
                    <article
                      className={`ob-card ob-node ${!s.online ? "is-offline" : ""} ${issue ? "ob-node-alert" : ""}`}
                      key={`${index}-${s.name}`}
                    >
                      <div className="ob-card-head">
                        <span className="ob-flag">
                          {s.region || <Globe2 size={24} />}
                        </span>
                        <div>
                          <h3>{s.name || "未命名节点"}</h3>
                          {tech && (
                            <code className="ob-node-ip">
                              {nodeIPMap.find((r) => r.name === s.name)?.ip ??
                                "IP 未关联"}
                            </code>
                          )}
                          <p>
                            {[s.region_city, s.provider_name]
                              .filter(Boolean)
                              .join(" / ") || "地区与服务商未设置"}
                          </p>
                        </div>
                        <span
                          className={`ob-node-status ${!s.online ? "off" : issue ? "warn" : ""}`}
                        >
                          <i />
                          {s.online ? "在线" : "离线"}
                        </span>
                      </div>
                      {issue && (
                        <div className="ob-issue-label">
                          {networkIssueLabel(s, payload!)}
                          {networkIssue(s, payload!) &&
                          probeHealthIssue(s, used)
                            ? " · "
                            : ""}
                          {probeHealthIssue(s, used) ? "资源占用 >90%" : ""}
                        </div>
                      )}
                      <TriRows server={s} data={payload!} family={family} />
                      {page !== "network" && (
                        <>
                          <div className="ob-resources">
                            <Meter
                              label="CPU"
                              value={s.online ? s.cpu_pct : undefined}
                            />
                            <Meter
                              label="内存"
                              value={s.online ? memPct(s) : undefined}
                            />
                            <Meter
                              label="硬盘"
                              value={s.online ? diskPct(s) : undefined}
                            />
                          </div>
                          <div className="ob-speed">
                            <span>
                              <ArrowDown size={13} />
                              <b>{s.online ? size(s.download_speed) : "—"}</b>
                              <small>/s</small>
                            </span>
                            <span>
                              <ArrowUp size={13} />
                              <b>{s.online ? size(s.upload_speed) : "—"}</b>
                              <small>/s</small>
                            </span>
                            <span className="ob-connection-count">
                              TCP {s.online ? (s.tcp_connections ?? "—") : "—"}
                              {tech && <> · UDP {s.online ? (s.udp_connections ?? "—") : "—"}</>}
                            </span>
                          </div>
                          <div className="ob-quota">
                            <div>
                              <span>周期计费用量</span>
                              <b>
                                {size(used)} /{" "}
                                {limit === 0 ? "不限" : size(limit)}
                              </b>
                            </div>
                            <div className="ob-track">
                              <i
                                style={{
                                  width:
                                    limit && used !== undefined
                                      ? `${Math.min(100, (used / limit) * 100)}%`
                                      : "0%",
                                }}
                              />
                            </div>
                            <p>
                              {trafficRuleLabel(s)} ·{" "}
                              {s.period_end
                                ? `${s.period_end} 重置`
                                : "重置日期未提供"}
                            </p>
                          </div>
                        </>
                      )}
                      {tech && page !== "network" && (
                        <dl className="ob-node-facts">
                          <div><dt>内存</dt><dd>{s.online ? size(s.mem_used) : "—"} / {size(s.mem_total)}</dd></div>
                          <div><dt>磁盘</dt><dd>{s.online ? size(s.disk_used) : "—"} / {size(s.disk_total)}</dd></div>
                          <div><dt>系统</dt><dd>{[s.os, s.arch].filter(Boolean).join(" · ") || "—"}</dd></div>
                          <div><dt>负载</dt><dd>{s.online ? s.loadavg ?? "—" : "—"}</dd></div>
                          <div><dt>在线时长</dt><dd>{s.online && s.uptime !== undefined ? `${Math.floor(s.uptime / 86400)}天 ${Math.floor(s.uptime % 86400 / 3600)}小时` : "—"}</dd></div>
                          {(owner || isDemo) && <div><dt>到期日期</dt><dd>{s.expires_at ? s.expires_at.slice(0, 10) : "未填写"}</dd></div>}
                          <div><dt>周期上行</dt><dd>{size(s.traffic_used_up)}</dd></div>
                          <div><dt>周期下行</dt><dd>{size(s.traffic_used_down)}</dd></div>
                        </dl>
                      )}
                      {tech && (owner || isDemo) && (s.renewal_price !== undefined || s.renewal_price_cny !== undefined || s.renewal_cycle) && (
                        <div className="ob-owner-renewal">
                          <span>仅所有者 · 套餐与续费</span>
                          <strong>{s.renewal_price_cny !== undefined ? `¥${s.renewal_price_cny.toFixed(2)}` : s.renewal_price !== undefined ? `${s.renewal_currency ?? "CNY"} ${s.renewal_price.toFixed(2)}` : "金额未提供"}</strong>
                          <small>{({month:"月付",quarter:"季付",half_year:"半年付",year:"年付",two_year:"两年付",three_year:"三年付",permanent:"永久"} as Record<string,string>)[s.renewal_cycle ?? ""] ?? "周期未提供"} · {s.expires_at ? `${s.expires_at.slice(0,10)} 到期` : "到期日未提供"}</small>
                        </div>
                      )}
                      {!s.online && s.last_seen && (
                        <p className="ob-hint">
                          最后在线 {relativeTime(s.last_seen)}
                        </p>
                      )}
                      <div className="ob-card-footer">
                        <span>
                          {s.cpu_cores ? `${s.cpu_cores} vCPU` : "—"}
                          <em />
                          {size(s.mem_total)} RAM
                        </span>
                        <button
                          className="ob-detail-button"
                          onClick={() =>
                            setSelected({ index, name: s.name, tab: "ip" })
                          }
                        >
                          IP 报告 <ShieldCheck size={12} />
                        </button>
                        <button
                          className="ob-detail-button"
                          onClick={() => setSelected({ index, name: s.name })}
                        >
                          节点详情 <ArrowUpRight size={12} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!visible.length && (
                <div className="ob-empty">
                  {payload
                    ? "没有符合条件的节点"
                    : error
                      ? "等待连接主控数据"
                      : "正在获取节点状态…"}
                </div>
              )}
            </section>
          </>
        )}
        {tech && page === "overview" && (
          <section className="ob-ip-panel ob-node-directory">
            <div className="ob-section-title">
              <h2>
                <ShieldCheck size={18} /> 节点 IP 检测
              </h2>
              <span>按主控地址关联 · 点击直接查看报告</span>
            </div>
            <div className="ob-ip-directory-grid">
              {servers.map((server, index) => (
                <button
                  key={index}
                  onClick={() =>
                    setSelected({ index, name: server.name, tab: "ip" })
                  }
                >
                  <strong>{server.name}</strong>
                  <code>
                    {nodeIPMap.find((r) => r.name === server.name)?.ip ??
                      "IP 未关联"}
                  </code>
                  <span>查看检测结果 ↗</span>
                </button>
              ))}
            </div>
            <p className="ob-hint">
              地址取自主控服务管理，尚未独立验证为实际出站
              IP。风险评分仅显示来源已返回的值。
            </p>
          </section>
        )}
        <footer className="ob-footer">
          <span>
            <Radio size={14} /> Powered by MiaoMiaoWu X
          </span>
          <span>
            {isDemo ? "演示数据 · 非实际监控结果" : "公开监控不提供 VPS 金额"}
          </span>
        </footer>
      </main>
      {selectedServer && selected && payload && (
        <Detail
          key={`${selected.index}-${selected.name}`}
          server={selectedServer}
          index={selected.index}
          data={payload}
          isDemo={isDemo}
          family={family}
          initialTab={selected.tab}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  );
}
function LiveDashboard() {
  const state = useProbe();
  return <Dashboard {...state} />;
}
export function Observatory() {
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") {
    const custom = params.get("theme") === "xin-observatory";
    return <div className={custom ? "xin-tech" : undefined}><Dashboard data={demo} isDemo tech={custom} /></div>;
  }
  return <LiveDashboard />;
}
