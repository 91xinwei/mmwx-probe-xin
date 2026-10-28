import { useEffect, useState } from "react";
import { LockKeyhole, ExternalLink } from "lucide-react";
import type { ProbeServer } from "./types";
import { readOwnerJSON, ownerAccessMessage, OwnerAccessError } from "./owner-access";
import { safeLink } from "./observatory-data";
const cycles: Record<string, number> = {
  month: 1,
  quarter: 3,
  half_year: 6,
  year: 12,
  two_year: 24,
  three_year: 36,
};
const cycleNames: Record<string, string> = {
  month: "月",
  quarter: "季",
  half_year: "半年",
  year: "年",
  two_year: "两年",
  three_year: "三年",
  permanent: "永久",
};
export function monthlyCost(s: ProbeServer): number | undefined {
  const price =
    s.renewal_price_cny ??
    (s.renewal_currency === "CNY" ? s.renewal_price : undefined);
  const months = cycles[s.renewal_cycle ?? ""];
  return price !== undefined && Number.isFinite(price) && price >= 0 && months
    ? price / months
    : undefined;
}
export function OwnerCosts({ isDemo }: { isDemo: boolean }) {
  const [servers, setServers] = useState<ProbeServer[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "locked" | "error">(
    "loading",
  );
  const [accessMessage, setAccessMessage] = useState("");
  useEffect(() => {
    if (isDemo) {
      setServers([
        {
          name: "BWG · 洛杉矶",
          online: true,
          renewal_price: 49.99,
          renewal_currency: "USD",
          renewal_price_cny: 360,
          renewal_cycle: "year",
          expires_at: "2026-11-20",
        },
        {
          name: "DMIT · 洛杉矶",
          online: true,
          renewal_price: 9.99,
          renewal_currency: "USD",
          renewal_price_cny: 72,
          renewal_cycle: "month",
          expires_at: "2026-11-12",
        },
        { name: "VMISS · 东京", online: true },
      ]);
      setStatus("ok");
      return;
    }
    const controller = new AbortController();
    fetch("/api/owner/costs", { cache: "no-store", signal: controller.signal, redirect: "error" })
      .then(async (response) => {
        const payload = await readOwnerJSON<{ servers?: ProbeServer[] }>(response);
        setServers(payload.servers ?? []);
        setStatus("ok");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setAccessMessage(ownerAccessMessage(e));
          setStatus(e instanceof OwnerAccessError || e instanceof TypeError || import.meta.env.PROBE_READONLY_PREVIEW ? "locked" : "error");
        }
      });
    return () => controller.abort();
  }, [isDemo]);
  if (status === "loading")
    return <div className="ob-empty">正在验证所有者身份…</div>;
  if (status === "locked")
    return (
      <div className="ob-owner-lock">
        <LockKeyhole size={28} />
        <h2>成本与续费仅对所有者开放</h2>
        <p>{accessMessage || "需要使用已授权的 Cloudflare Access 身份访问。"}</p>
        <a className="ob-action" href="/owner">
          验证所有者身份
        </a>
        <p>未配置所有者认证时，此入口不会返回成本数据。</p>
      </div>
    );
  if (status === "error")
    return (
      <div className="ob-empty" role="alert">
        成本数据暂时不可用，请稍后重新进入此视图。
      </div>
    );
  const known = servers.flatMap((s) =>
    monthlyCost(s) === undefined ? [] : [monthlyCost(s)!],
  );
  const monthly = known.reduce((a, b) => a + b, 0);
  const fmt = (n: number) => `¥${n.toFixed(2)}`;
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Shanghai",
  });
  const dateValue = (s: string) => Date.parse(`${s}T00:00:00+08:00`);
  const due = servers.filter(
    (s) =>
      s.expires_at &&
      s.renewal_cycle !== "permanent" &&
      dateValue(s.expires_at) - dateValue(today) <= 30 * 86400000,
  );
  return (
    <section className="ob-costs">
      <div className="ob-section-title">
        <h2>
          <LockKeyhole size={18} /> 成本与续费
        </h2>
        <span>{isDemo ? "仅为虚构金额演示" : "所有者私有 · 不缓存"}</span>
      </div>
      <div className="ob-cost-stats">
        <article>
          <span>已知月均成本</span>
          <strong>{known.length ? fmt(monthly) : "—"}</strong>
          <small>
            {known.length} / {servers.length} 台具备完整价格与周期
          </small>
        </article>
        <article>
          <span>已知年均成本</span>
          <strong>{known.length ? fmt(monthly * 12) : "—"}</strong>
          <small>按周期折算，不代表本年实际付款</small>
        </article>
        <article>
          <span>30 天内到期 / 已逾期</span>
          <strong>
            {due.length}
            <small> 台</small>
          </strong>
          <small>按北京时间日期计算</small>
        </article>
      </div>
      <div className="ob-table-scroll">
        <table className="ob-cost-table">
          <thead>
            <tr>
              <th>节点</th>
              <th>原币续费价</th>
              <th>折算月均</th>
              <th>续费日期</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody>
            {[...servers]
              .sort((a, b) =>
                (a.expires_at ?? "9999").localeCompare(b.expires_at ?? "9999"),
              )
              .map((s, i) => (
                <tr key={i}>
                  <td>{s.name || "未命名节点"}</td>
                  <td>
                    {s.renewal_price === undefined
                      ? "未填写"
                      : `${s.renewal_currency ?? "币种未设置"} ${s.renewal_price.toFixed(2)} / ${cycleNames[s.renewal_cycle ?? ""] ?? "周期未设置"}`}
                  </td>
                  <td>
                    {monthlyCost(s) === undefined ? "—" : fmt(monthlyCost(s)!)}
                  </td>
                  <td>
                    {s.renewal_cycle === "permanent"
                      ? "永久"
                      : (s.expires_at ?? "未填写")}
                  </td>
                  <td>
                    {safeLink(s.provider_url) ? (
                      <a
                        href={safeLink(s.provider_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.provider_name || "服务商"} <ExternalLink size={12} />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="ob-hint">
        金额来自主控续费字段；首次购买价和实际付款历史尚无数据源。缺失价格不按 0
        计入合计。
      </p>
      {!isDemo && (
        <a className="ob-signout" href="/cdn-cgi/access/logout">
          退出所有者身份
        </a>
      )}
    </section>
  );
}
