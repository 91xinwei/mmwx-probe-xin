import { IPQuality } from "./IPQuality";
import "./observatory.css";
import "./embedded-ip-quality.css";

export function EmbeddedIPQuality() {
  return (
    <div className="embedded-ip-quality" id="ip-quality">
      <IPQuality />
    </div>
  );
}
