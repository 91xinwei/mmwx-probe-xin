import { useLayoutEffect } from "react";
import { PremiumProbePage } from "./PremiumProbePage";
import { EmbeddedIPQuality } from "./EmbeddedIPQuality";
import { useProbe } from "./use-probe";

// Compose extensions outside the upstream page; never patch built-in themes.
export function CustomProbeTheme() {
  const { data, error } = useProbe(true);
  useLayoutEffect(() => {
    document.documentElement.classList.add("theme-premium");
    return () => document.documentElement.classList.remove("theme-premium");
  }, [data]);
  if (!data) return <main className="center">{error || "正在连接主控…"}</main>;
  if (!data.enabled) return <main className="center">探针尚未启用</main>;
  return (
    <div className="xin-custom-probe">
      <PremiumProbePage data={data} isLoading={false} isError={false} />
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px 24px" }}>
        <EmbeddedIPQuality />
      </div>
    </div>
  );
}
