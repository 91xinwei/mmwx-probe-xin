import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { PremiumProbePage } from "./PremiumProbePage";
import { EmbeddedIPQuality } from "./EmbeddedIPQuality";
import { useProbe } from "./use-probe";

// Compose extensions outside the upstream page; never patch built-in themes.
export function CustomProbeTheme() {
  const { data, error } = useProbe(true);
  const container = useRef<HTMLDivElement>(null);
  const [reportHost, setReportHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setReportHost(
      container.current?.querySelector<HTMLElement>(
        ".premium-probe-page > main",
      ) ?? null,
    );
  }, [data?.enabled]);
  useLayoutEffect(() => {
    document.documentElement.classList.add("theme-premium");
    return () => document.documentElement.classList.remove("theme-premium");
  }, [data]);
  if (!data) return <main className="center">{error || "正在连接主控…"}</main>;
  if (!data.enabled) return <main className="center">探针尚未启用</main>;
  return (
    <div className="xin-custom-probe" ref={container}>
      <PremiumProbePage data={data} isLoading={false} isError={false} />
      {reportHost && createPortal(<EmbeddedIPQuality />, reportHost)}
    </div>
  );
}
