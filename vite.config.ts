import { loadIPReports } from "./worker/ip-reports";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const runFile = promisify(execFile);
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { publicResponse } from "./worker/public-data";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "PROBE_");
  const preview =
    command === "serve" && env.PROBE_PREVIEW_ORIGIN
      ? new URL(env.PROBE_PREVIEW_ORIGIN)
      : undefined;
  if (preview && preview.protocol !== "https:")
    throw new Error("Preview origin must use HTTPS");
  return {
    plugins: [
      react(),
      ...(preview
        ? [
            {
              name: "read-only-public-probe-preview",
              apply: "serve" as const,
              configureServer(server: import("vite").ViteDevServer) {
                server.middlewares.use(async (request, response, next) => {
                  const incoming = new URL(
                    request.url ?? "/",
                    "http://localhost",
                  );
                  if (incoming.pathname === "/api/ip-reports") {
                    if (request.method !== "GET") {
                      response.statusCode = 405;
                      response.end();
                      return;
                    }
                    response.setHeader("Content-Type", "application/json");
                    response.setHeader("Cache-Control", "no-store");
                    const payload = await loadIPReports(async (ip) => {
                      const url = new URL("https://api.ip2location.io/");
                      url.searchParams.set("ip", ip);
                      const { stdout } = await runFile(
                        "curl",
                        ["-fsS", "--max-time", "12", url.href],
                        { maxBuffer: 1024 * 1024 },
                      );
                      return JSON.parse(stdout);
                    }, undefined, async (ip) => {
                      const { stdout } = await runFile("curl", ["-fsS", "--max-time", "12", `https://ip.net.coffee/api/iprisk/${encodeURIComponent(ip)}`], { maxBuffer: 1024 * 1024 });
                      return JSON.parse(stdout);
                    }, async ip => {
                      const {stdout}=await runFile("curl",["-fsS","--max-time","12",`https://ipinfo.io/${encodeURIComponent(ip)}/json`],{maxBuffer:1024*1024});
                      return JSON.parse(stdout);
                    });
                    response.end(JSON.stringify(payload));
                    return;
                  }
                  if (incoming.pathname.startsWith("/api/owner/")) {
                    response.statusCode = 403;
                    response.setHeader("Content-Type", "application/json");
                    response.setHeader("Cache-Control", "no-store");
                    response.end(
                      JSON.stringify({
                        error:
                          "Owner data is disabled in public-source preview",
                      }),
                    );
                    return;
                  }
                  if (
                    !["/api/probe", "/api/series", "/api/forward"].includes(
                      incoming.pathname,
                    )
                  )
                    return next();
                  response.setHeader("Content-Type", "application/json");
                  response.setHeader("Cache-Control", "no-store");
                  try {
                    const upstream = new URL(
                      incoming.pathname + incoming.search,
                      preview!.origin,
                    );
                    // curl uses the workstation's configured network proxy; Node's
                    // default fetch does not. This adapter only runs in Vite dev mode.
                    const { stdout } = await runFile(
                      "curl",
                      [
                        "-fsS",
                        "--max-time",
                        "15",
                        upstream.href,
                        "-H",
                        `Referer: ${preview!.origin}/`,
                        "-H",
                        "Sec-Fetch-Site: same-origin",
                        "-H",
                        "Accept: application/json",
                      ],
                      { maxBuffer: 8 * 1024 * 1024 },
                    );
                    response.end(
                      JSON.stringify(
                        publicResponse(
                          incoming.pathname,
                          JSON.parse(stdout),
                          incoming.searchParams.get("metric"),
                        ),
                      ),
                    );
                  } catch {
                    response.statusCode = 502;
                    response.end(
                      JSON.stringify({ error: "Public source unavailable" }),
                    );
                  }
                });
              },
            },
          ]
        : []),
    ],
    define: {
      "import.meta.env.PROBE_READONLY_PREVIEW": JSON.stringify(!!preview),
    },
    server: {
      proxy: preview ? undefined : { "/api": "http://127.0.0.1:8787" },
    },
  };
});
