import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() =>
  import("./App").then((module) => ({ default: module.App })),
);
const Observatory = lazy(() =>
  import("./Observatory").then((module) => ({ default: module.Observatory })),
);
import { applyAppearance } from "./use-probe";
import "./styles.css";

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
      {!useObservatory ? <App /> : <Observatory />}
    </Suspense>
  </StrictMode>,
);
