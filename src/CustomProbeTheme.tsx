import { Dashboard } from "./Observatory";
import { useProbe } from "./use-probe";
import "./custom-probe-tech.css";

// Independent theme: no dependency on the built-in Premium page or its skin.
export function CustomProbeTheme() {
  const state = useProbe(true);
  return (
    <div className="xin-tech">
      <Dashboard {...state} data={state.data} isDemo={false} tech />
    </div>
  );
}
