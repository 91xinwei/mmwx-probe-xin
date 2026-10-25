import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() =>
  import("./App").then((module) => ({ default: module.App })),
);
import { Observatory } from "./Observatory";
import { applyAppearance } from "./use-probe";
import "./styles.css";

applyAppearance();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div className="center">加载监控视图…</div>}>
      {new URLSearchParams(location.search).get("view") === "classic" ? (
        <App />
      ) : (
        <Observatory />
      )}
    </Suspense>
  </StrictMode>,
);
