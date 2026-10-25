import { StrictMode, lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() =>
  import("./App").then((module) => ({ default: module.App })),
);
const Observatory = lazy(() =>
  import("./Observatory").then((module) => ({ default: module.Observatory })),
);
import { applyAppearance } from "./use-probe";
import "./styles.css";
const CustomProbeTheme = lazy(() =>
  import("./CustomProbeTheme").then((m) => ({ default: m.CustomProbeTheme })),
);
function ThemeEntry() {
  const [theme, setTheme] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/probe", { cache: "no-store", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ appearance?: { theme?: string } }>;
      })
      .then((data) => setTheme(data.appearance?.theme ?? "default"))
      .catch(() => {
        if (!controller.signal.aborted) setTheme("default");
      });
    return () => controller.abort();
  }, []);
  if (theme === undefined)
    return <main className="center">正在读取探针主题…</main>;
  return theme === "xin-observatory" ? <CustomProbeTheme /> : <App />;
}

const params = new URLSearchParams(location.search);
const useObservatory =
  location.pathname === "/owner" ||
  params.get("view") === "observatory" ||
  params.get("tab") === "ip" ||
  params.get("demo") === "1";

applyAppearance();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div className="center">加载监控视图…</div>}>
      {!useObservatory ? <ThemeEntry /> : <Observatory />}
    </Suspense>
  </StrictMode>,
);
