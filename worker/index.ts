import { ipReportsResponse } from "./ip-reports";
import { publicResponse, publicFrame, project } from "./public-data";
import { isOwner, ownerConfig, type OwnerEnv } from "./owner-auth";

interface Env extends OwnerEnv {
  ASSETS: Fetcher;
  MMWX_ORIGIN: string;
  PROBE_TOKEN: string;
  IP2LOCATION_API_KEY?: string;
}

const routes: Record<string, string> = {
  "/api/probe": "/api/public/probe-servers",
  "/api/series": "/api/public/probe-series",
  "/api/stream": "/api/public/probe-ws",
  "/api/forward": "/api/public/probe-forward",
};

// passkey 登录:唯一允许 POST 上游的两条,且**原样透传路径**。
//
// 其余代理一律只读 GET(见下面的 405),这两条是例外 —— WebAuthn 是挑战-响应,必须
// POST 回签名。主控侧把它们放进了 securechan 公开白名单(securechan_allowlist.go),
// 因为本探针是独立构建、没有 securechan 客户端,sc/v2 的 op token 又随主控版本轮换。
//
// 注意不带 PROBE_TOKEN:那是探针只读接口的专用凭据,不该外泄到鉴权端点上。
const authRoutes = new Set([
  "/api/login/passkey/begin",
  "/api/login/passkey/finish",
]);

function upstreamURL(request: Request, env: Env): URL | null {
  const incoming = new URL(request.url);
  const path = routes[incoming.pathname];
  if (!path) return null;

  const origin = new URL(env.MMWX_ORIGIN);
  if (
    origin.protocol !== "https:" &&
    origin.hostname !== "127.0.0.1" &&
    origin.hostname !== "localhost"
  ) {
    throw new Error("MMWX_ORIGIN must use HTTPS");
  }
  origin.pathname = path;
  origin.search = incoming.search;
  return origin;
}

async function proxyAuth(
  request: Request,
  incoming: URL,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const origin = new URL(env.MMWX_ORIGIN);
  origin.pathname = incoming.pathname;
  origin.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  // 主控用 X-Forwarded-Host / -Proto 推导 WebAuthn 的 RP 与 origin。少了 Proto,
  // 主控会认为不是 HTTPS,直接判成非 secure context 并拒发 challenge。
  headers.set("X-Forwarded-Host", incoming.host);
  headers.set("X-Forwarded-Proto", "https");

  const upstream = await fetch(
    new Request(origin.toString(), {
      method: "POST",
      headers,
      body: request.body,
    }),
  );
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.delete("set-cookie");

  // 登录成功时才把主控地址交给前端 —— 它要靠这个把登录态带过去。
  // 探针是伪装页,主控地址不能白给所有访客,所以只在 finish 成功的响应里注入:
  // 拿不出有效 passkey 断言的人根本走不到这一步。
  if (incoming.pathname.endsWith("/finish") && upstream.ok) {
    try {
      const payload = (await upstream.json()) as Record<string, unknown>;
      payload.master_origin = env.MMWX_ORIGIN;
      return new Response(JSON.stringify(payload), {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      return new Response("Bad upstream response", { status: 502 });
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

// 密钥由本 Worker 代加,主控见密钥即放行,来源只能在这里校验(判据对齐主控 probeSameOriginRequest):
// 别的网站在浏览器里 fetch / 嵌入探针接口一律 404,没有任何来源信息的裸请求同样拒绝。
function fromOwnPage(request: Request, self: string): boolean {
  const origin = request.headers.get("Origin");
  if (origin) return origin === self;
  const site = request.headers.get("Sec-Fetch-Site");
  if (site) return site === "same-origin";
  try {
    return new URL(request.headers.get("Referer") ?? "").origin === self;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url);
    if (incoming.pathname === "/api/ip-reports") {
      if (request.method !== "GET")
        return json({ error: "Method not allowed" }, 405);
      if (!fromOwnPage(request, incoming.origin))
        return json({ error: "Not found" }, 404);
      return ipReportsResponse(request, env.IP2LOCATION_API_KEY);
    }
    if (incoming.pathname === "/login") {
      return Response.redirect(
        new URL("/login", env.MMWX_ORIGIN).toString(),
        302,
      );
    }
    if (authRoutes.has(incoming.pathname)) {
      return proxyAuth(request, incoming, env);
    }

    const ownerPath = incoming.pathname.startsWith("/api/owner/");
    if (ownerPath) {
      if (request.method !== "GET")
        return json({ error: "Method not allowed" }, 405);
      if (!(await isOwner(request, env)))
        return json(
          {
            error: "Owner authentication required",
            configured: !!ownerConfig(env),
          },
          403,
        );
      if (incoming.pathname === "/api/owner/session")
        return json({ owner: true });
      if (incoming.pathname !== "/api/owner/costs")
        return json({ error: "Not found" }, 404);
      if (!env.PROBE_TOKEN)
        return json({ error: "Probe is not configured" }, 503);
      const target = upstreamURL(
        new Request(new URL("/api/probe", incoming)),
        env,
      )!;
      const upstream = await fetch(target, {
        headers: {
          "X-MMwx-Probe-Token": env.PROBE_TOKEN,
          "X-Forwarded-Host": incoming.host,
        },
      });
      if (!upstream.ok) return json({ error: "Upstream unavailable" }, 502);
      try {
        const data = (await upstream.json()) as {
          enabled?: boolean;
          servers?: unknown[];
        };
        const shape = {
          name: true,
          provider_name: true,
          provider_url: true,
          region: true,
          expires_at: true,
          renewal_price: true,
          renewal_currency: true,
          renewal_cycle: true,
          renewal_price_cny: true,
        } as const;
        return json({
          enabled: data.enabled,
          servers: data.enabled
            ? (data.servers ?? []).map((s) => project(s, shape))
            : [],
        });
      } catch {
        return json({ error: "Invalid upstream response" }, 502);
      }
    }
    const target = upstreamURL(request, env);
    if (!target) return env.ASSETS.fetch(request);
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    if (!fromOwnPage(request, incoming.origin))
      return new Response("Not found", { status: 404 });
    if (!env.PROBE_TOKEN) {
      return new Response("Probe access secret is not configured", {
        status: 503,
      });
    }

    const headers = new Headers(request.headers);
    headers.delete("cookie");
    headers.delete("authorization");
    headers.delete("cf-access-jwt-assertion");
    headers.delete("cf-access-authenticated-user-email");
    headers.set("X-Forwarded-Host", new URL(request.url).host);
    headers.set("X-MMwx-Probe-Token", env.PROBE_TOKEN);

    const upstream = await fetch(
      new Request(target, { method: "GET", headers }),
    );
    if (upstream.webSocket) return relayPublicStream(upstream.webSocket);
    if (!upstream.ok)
      return json({ error: "Upstream unavailable" }, upstream.status);
    try {
      return json(
        publicResponse(
          incoming.pathname,
          await upstream.json(),
          incoming.searchParams.get("metric"),
        ),
      );
    } catch {
      return json({ error: "Invalid upstream response" }, 502);
    }
  },
} satisfies ExportedHandler<Env>;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Cf-Access-Jwt-Assertion",
    },
  });
}

function relayPublicStream(upstream: WebSocket): Response {
  const pair = new WebSocketPair();
  const client = pair[0],
    server = pair[1];
  const stop = () => {
    try {
      server.close(1000, "Stream ended");
    } catch {}
    try {
      upstream.close(1000, "Stream ended");
    } catch {}
  };
  upstream.addEventListener("message", (event) => {
    try {
      server.send(publicFrame(event.data));
    } catch {
      stop();
    }
  });
  upstream.addEventListener("close", stop);
  upstream.addEventListener("error", stop);
  server.addEventListener("close", stop);
  server.addEventListener("error", stop);
  // This is a read-only snapshot stream: client frames are never forwarded.
  server.accept();
  upstream.accept();
  return new Response(null, { status: 101, webSocket: client });
}
