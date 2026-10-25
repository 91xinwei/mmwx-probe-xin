import { useEffect, useState } from "react";
import type { ProbeServer } from "./types";
import {
  unlockServiceMeta,
  unlockStatusText,
  unlockStatusMeta,
} from "./unlock-services";
import { SeriesChart } from "./ProbeCharts";
import {
  resourceHistoryFromSeries,
  type ResourceSeriesInput,
} from "./resource-history";
import {
  probeRangeBucketCount,
  probeRangeBucketSec,
  probeRangeOptions,
} from "./probe-ranges";
import { connHistoryFromSeries, type ProbeMetricPoint } from "./conn-sparkline";
export function UnlockResults({ server }: { server: ProbeServer }) {
  return (
    <>
      <p className="ob-hint">服务端实测解锁结果 · 与普通目标连通性区分展示</p>
      {server.unlocks?.length ? (
        <div className="ob-unlock-grid">
          {server.unlocks.map((u, i) => (
            <article
              key={`${u.service}-${i}`}
              className={`ob-unlock-${unlockStatusMeta(u.status).tone}`}
            >
              <h4>{unlockServiceMeta(u.service).label}</h4>
              <strong>{unlockStatusText(u, true)}</strong>
              <small>
                {u.tested_at
                  ? new Date(u.tested_at).toLocaleString("zh-CN")
                  : "检测时间未提供"}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <div className="ob-empty">服务端尚未提供此节点的解锁结果</div>
      )}
    </>
  );
}
export function ResourceHistory({
  server,
  index,
  isDemo,
  historyDays,
}: {
  server: ProbeServer;
  index: number;
  isDemo: boolean;
  historyDays?: number;
}) {
  const [range, setRange] = useState("1h");
  const [history, setHistory] = useState<{
    series?: ResourceSeriesInput & {
      tcp_connections?: ProbeMetricPoint[];
      udp_connections?: ProbeMetricPoint[];
    };
    generated_at: number;
    bucket_sec: number;
    buckets?: number;
  }>();
  const [error, setError] = useState(false);
  const options = probeRangeOptions(historyDays);
  const activeRange = options.some((r) => r.key === range) ? range : "1h";
  useEffect(() => {
    setHistory(undefined);
    setError(false);
    if (isDemo || !server.online) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(
          `/api/series?${new URLSearchParams({ server: String(index), metric: "system", range: activeRange })}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const result = (await response.json()) as NonNullable<
          typeof history
        > & { success?: boolean };
        if (!result.success) throw new Error();
        setHistory(result);
        setError(false);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setError(true);
      }
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [index, activeRange, isDemo, server.online]);
  const count = history?.buckets ?? probeRangeBucketCount(activeRange);
  const normalized = history
    ? resourceHistoryFromSeries(
        history.series,
        history.generated_at,
        history.bucket_sec,
        count,
      )
    : undefined;
  const connections = history
    ? connHistoryFromSeries(
        history.series?.tcp_connections,
        history.series?.udp_connections,
        history.generated_at,
        history.bucket_sec,
        count,
      )
    : undefined;
  return (
    <>
      <h3>系统资源历史</h3>
      <div className="ob-range">
        {options.map((r) => (
          <button
            key={r.key}
            className={activeRange === r.key ? "active" : ""}
            disabled={isDemo && r.key !== "1h"}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {isDemo ? (
        <p className="ob-hint">
          演示模式未生成系统资源历史。连接数使用下方演示样本。
        </p>
      ) : error ? (
        <p className="ob-hint" role="alert">
          资源历史暂时获取失败
        </p>
      ) : !server.online ? (
        <p className="ob-hint">离线节点不展示实时资源历史</p>
      ) : !history ? (
        <p className="ob-hint">正在读取资源历史…</p>
      ) : (
        <SeriesChart
          unit="%"
          maxValue={100}
          label="CPU 内存 硬盘占用率"
          rows={[
            { label: "CPU", color: "#ba8d36", values: normalized?.cpu ?? [] },
            { label: "内存", color: "#5a87bd", values: normalized?.mem ?? [] },
            { label: "硬盘", color: "#55a28b", values: normalized?.disk ?? [] },
          ]}
        />
      )}
      <h3>TCP / UDP 连接数历史</h3>
      <SeriesChart
        label="TCP UDP 系统连接数"
        unit="个"
        rows={[
          {
            label: "TCP",
            color: "#ba8d36",
            values: server.online
              ? (connections?.tcp ??
                (activeRange === "1h" ? server.conn_history?.tcp : []) ??
                [])
              : [],
          },
          {
            label: "UDP",
            color: "#5a87bd",
            values: server.online
              ? (connections?.udp ??
                (activeRange === "1h" ? server.conn_history?.udp : []) ??
                [])
              : [],
          },
        ]}
      />
      <p className="ob-hint">整机系统连接数，并非代理用户数。</p>
    </>
  );
}
