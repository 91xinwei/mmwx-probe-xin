import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";
import snapshot from "./data/ip-reports.json";
import {
  linkedReports,
  metricText,
  reportLink,
  reportSources,
  type IPReport,
  type IPReportPayload,
} from "./ip-reports";
function observedTime(value: string) {
  if (!value) return "未获取";
  if (value.length === 10) return value;
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
    : "未获取";
}
function ReportCard({ report }: { report: IPReport }) {
  const url = reportLink(report);
  return (
    <article className="ob-report-card">
      <div className="ob-report-heading">
        <div>
          <span className="ob-eyebrow">{report.source_name}</span>
          <h3>{report.ip}</h3>
        </div>
        <span className="ob-report-kind">
          {report.collection === "page_snapshot"
            ? "页面读取快照"
            : "接口查询结果"}
        </span>
      </div>
      <div className="ob-report-tags">
        {report.tags?.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="ob-report-metrics">
        {report.metrics.length ? (
          report.metrics.map((m) => (
            <div key={m.label}>
              <span>{m.label}</span>
              <strong>{metricText(m)}</strong>
              <small>
                {m.direction === "higher_is_better"
                  ? "越高越好"
                  : "越低风险越小"}
              </small>
              {m.description && <p>{m.description}</p>}
            </div>
          ))
        ) : (
          <p className="ob-hint">
            此来源未提供风险评分，以下为已取得的 IP 信息。
          </p>
        )}
      </div>
      <dl className="ob-report-facts">
        {[
          ["使用地区", report.geography],
          ["注册地区", report.registration_country],
          ["ASN", report.asn],
          ["网络组织", report.organization],
          ["网段", report.network],
          [
            "公开代理标记",
            report.is_proxy === undefined
              ? undefined
              : report.is_proxy
                ? "该来源标记为代理"
                : "该来源未标记为公开代理",
          ],
        ]
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {report.asn_traffic && (
        <div className="ob-asn-traffic">
          <span>ASN 级流量构成</span>
          <div>
            <i style={{ width: `${report.asn_traffic.human}%` }} />
          </div>
          <p>
            人类 {report.asn_traffic.human}% · 自动化{" "}
            {report.asn_traffic.automated}%
          </p>
          <small>整个 ASN 的统计，不代表此 IP 自身流量比例。</small>
        </div>
      )}
      <div className="ob-report-bottom">
        <span>
          读取于 {observedTime(report.observed_at)}
          {report.collection === "api" && report.observed_at.length > 10
            ? "（北京时间）"
            : ""}
          {report.refresh_status === "failed" && <b>更新失败 · 保留快照</b>}
        </span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            查看原站结果 <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </article>
  );
}
export function IPQuality({ nodeName }: { nodeName?: string }) {
  const [reports, setReports] = useState<IPReport[]>(
    (snapshot as IPReportPayload).reports,
  );
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch("/api/ip-reports", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as IPReportPayload;
        if (!Array.isArray(payload.reports)) throw new Error();
        setReports(payload.reports);
        setStatus("ok");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [revision]);
  const visible = linkedReports(reports, nodeName);
  return (
    <section className="ob-ip-panel ob-ip-reports">
      <div className="ob-section-title">
        <h2>
          <ShieldCheck size={19} /> IP 信息与纯净度
        </h2>
        <button
          className="ob-report-refresh"
          onClick={() => setRevision((n) => n + 1)}
          disabled={status === "loading"}
        >
          <RefreshCw size={13} />
          {status === "loading" ? "更新中…" : "刷新查询"}
        </button>
      </div>
      <p>
        展示已读取的原站结果，并保留每个来源自己的评分口径。页面快照不随监控的实时指标变化。
      </p>
      {status === "error" && (
        <p className="ob-report-warning" role="status">
          暂时无法更新，以下保留上次读取的结果；可打开原站核对。
        </p>
      )}
      {nodeName !== undefined && !visible.length ? (
        <div className="ob-empty">
          此节点尚未关联已核验的出口 IP 报告。
          <a href="?tab=ip">查看已收录的 IP 报告 ↗</a>
        </div>
      ) : (
        <>
          <div className="ob-report-grid">
            {visible.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
          <p className="ob-hint">
            目前收录你提供的 24.249.30.27。未根据节点名称推测它对应哪台服务器。
          </p>
          <div className="ob-source-grid ob-source-status">
            {reportSources
              .filter((s) => !visible.some((r) => r.source === s.id))
              .map((s) => (
                <article key={s.id}>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <strong>未获取结果</strong>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    访问查询入口 <ArrowUpRight size={12} />
                  </a>
                </article>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
