import { useEffect, useRef, useState } from "react";
import type {
  ProbeAppearance,
  ProbePayload,
  ProbeServer,
  ThemeName,
} from "./types";
import { applyProbeDocumentBranding } from "./document-branding";
import { normalizeColorMode, type ProbeColorMode } from "./theme-preference";

const APPEARANCE_CACHE = "mmwx-probe-appearance";
const COLOR_MODE_PREFERENCE = "mmwx-probe-color-mode";

function normalizeTheme(value?: string): ThemeName {
  const theme = value?.trim();
  return theme && /^[A-Za-z0-9_-]{1,64}$/.test(theme) ? theme : "pixel";
}

export function applyAppearance(input?: ProbeAppearance) {
  const cached = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(APPEARANCE_CACHE) || "null",
      ) as ProbeAppearance | null;
    } catch {
      return null;
    }
  })();
  const appearance = input || cached || { theme: "pixel", color_mode: "light" };
  const theme = normalizeTheme(appearance.theme);
  const colorMode = readColorModePreference(appearance.color_mode);
  const root = document.documentElement;
  for (const className of Array.from(root.classList)) {
    if (className.startsWith("theme-")) root.classList.remove(className);
  }
  root.classList.remove("light", "dark");
  root.classList.add(`theme-${theme}`);
  const dark =
    colorMode === "dark" ||
    (colorMode === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.add(dark ? "dark" : "light");
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.themeReady = "true";
  if (input) {
    try {
      localStorage.setItem(APPEARANCE_CACHE, JSON.stringify(input));
    } catch {
      // Theme switching must keep working when storage is blocked.
    }
  }
}

export function readColorModePreference(
  fallback?: ProbeAppearance["color_mode"],
): ProbeColorMode {
  try {
    return normalizeColorMode(
      localStorage.getItem(COLOR_MODE_PREFERENCE),
      normalizeColorMode(fallback),
    );
  } catch {
    return normalizeColorMode(fallback);
  }
}

export function saveColorModePreference(mode: ProbeColorMode) {
  try {
    localStorage.setItem(COLOR_MODE_PREFERENCE, mode);
  } catch {
    // Applying the selected mode for the current page still succeeds.
  }
}

export function useProbe(includeOwnerCosts = location.pathname === "/owner"): {
  data?: ProbePayload;
  error?: string;
  updatedAt?: number;
} {
  const [data, setData] = useState<ProbePayload>();
  const [ownerCosts, setOwnerCosts] = useState<ProbeServer[]>([]);
  useEffect(() => {
    if (!includeOwnerCosts) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/owner/costs", {
          cache: "no-store",
          signal: controller.signal,
          redirect: "error",
        });
        if (!response.ok) {
          setOwnerCosts([]);
          return;
        }
        const result = (await response.json()) as { servers?: ProbeServer[] };
        if (!controller.signal.aborted) setOwnerCosts(result.servers ?? []);
      } catch {
        if (!controller.signal.aborted) setOwnerCosts([]);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 60000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [includeOwnerCosts]);
  const [error, setError] = useState<string>();
  const [updatedAt, setUpdatedAt] = useState<number>();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let stopped = false;
    let ws: WebSocket | undefined;

    const accept = (payload: ProbePayload) => {
      if (stopped) return;
      applyAppearance(payload.appearance);
      setData(payload);
      setUpdatedAt(Date.now());
      setError(undefined);
      applyProbeDocumentBranding(payload.title, payload.icon);
    };
    const poll = async () => {
      try {
        const response = await fetch("/api/probe", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        accept((await response.json()) as ProbePayload);
      } catch (cause) {
        if (!stopped)
          setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const startPolling = () => {
      if (timer.current) return;
      void poll();
      timer.current = window.setInterval(poll, 5000);
    };

    applyAppearance();
    // Keep polling as a fallback even when the WebSocket handshake succeeds.
    // Some proxies leave an idle WebSocket open without forwarding later frames,
    // which otherwise freezes realtime speed at the first snapshot.
    startPolling();
    try {
      if (import.meta.env.PROBE_READONLY_PREVIEW)
        return () => {
          stopped = true;
          if (timer.current) window.clearInterval(timer.current);
          timer.current = undefined;
        };
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${location.host}/api/stream`);
      ws.onmessage = (event) => {
        try {
          accept(JSON.parse(event.data) as ProbePayload);
        } catch {
          /* wait for next frame */
        }
      };
      ws.onerror = startPolling;
      ws.onclose = startPolling;
    } catch {
      startPolling();
    }

    return () => {
      stopped = true;
      ws?.close();
      if (timer.current) window.clearInterval(timer.current);
      timer.current = undefined;
    };
  }, []);

  // Attach private fields only to an unambiguous node name. Public WS updates
  // continue independently; private values are held in memory, never storage.
  const merged =
    data && ownerCosts.length
      ? {
          ...data,
          servers: data.servers?.map((server) => {
            if (
              !server.name ||
              (data.servers ?? []).filter((s) => s.name === server.name)
                .length !== 1
            )
              return server;
            const matches = ownerCosts.filter((s) => s.name === server.name);
            if (matches.length !== 1) return server;
            const cost = matches[0];
            return {
              ...server,
              renewal_price: cost.renewal_price,
              renewal_price_cny: cost.renewal_price_cny,
              renewal_currency: cost.renewal_currency,
              renewal_cycle: cost.renewal_cycle,
              expires_at: cost.expires_at,
            };
          }),
        }
      : data;
  return { data: merged, error, updatedAt };
}
