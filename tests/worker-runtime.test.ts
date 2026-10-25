import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

// Exercise the real Worker runtime, including two-hop WebSocket filtering.
test("runtime: HTTP/WS never expose cost, owner endpoint fails closed", async () => {
  const bundle = await build({
    entryPoints: ["worker/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "owner-test" };
  const sign = (email: string) =>
    new SignJWT({ email, type: "app" })
      .setProtectedHeader({ alg: "RS256", kid: "owner-test" })
      .setSubject("owner-test")
      .setIssuer("https://test.cloudflareaccess.com")
      .setAudience("owner-app")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  const snapshot = JSON.stringify({
    enabled: true,
    servers: [
      {
        name: "node",
        online: true,
        cpu_pct: 0,
        renewal_price: 49,
        renewal_currency: "USD",
        renewal_price_cny: 350,
        renewal_cycle: "year",
        expires_at: "2026-11-01",
        ip: "192.0.2.1",
        future_cost: 999,
      },
    ],
    total_cost: 500,
  });
  const upstream = `export default {async fetch(request){if(new URL(request.url).pathname==='/cdn-cgi/access/certs')return Response.json(${JSON.stringify({ keys: [jwk] })});if(new URL(request.url).pathname.endsWith('probe-ws')) {const pair=new WebSocketPair();pair[1].accept();pair[1].send(${JSON.stringify(snapshot)});return new Response(null,{status:101,webSocket:pair[0]});}return Response.json(${snapshot});}};`;
  const mf = new Miniflare({
    workers: [
      {
        name: "probe",
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: "2026-07-31",
        bindings: {
          MMWX_ORIGIN: "https://master.example",
          PROBE_TOKEN: "test-only",
          ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
          ACCESS_AUD: "owner-app",
          OWNER_EMAIL: "owner@example.com",
        },
        serviceBindings: { OUTBOUND: "upstream" },
        outboundService: "upstream",
      },
      {
        name: "upstream",
        modules: true,
        script: upstream,
        compatibilityDate: "2026-07-31",
      },
    ],
  });
  try {
    const clean = (text: string) => {
      for (const key of [
        "renewal",
        "expires_at",
        "192.0.2.1",
        "future_cost",
        "total_cost",
      ])
        assert.ok(!text.includes(key), key);
    };
    const http = await mf.dispatchFetch("https://probe.example/api/probe", {
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(http.status, 200);
    assert.match(http.headers.get("Cache-Control") ?? "", /no-store/);
    const text = await http.text();
    clean(text);
    assert.equal(JSON.parse(text).servers[0].cpu_pct, 0);
    const forbidden = await mf.dispatchFetch(
      "https://probe.example/api/owner/costs",
      { headers: { "Cf-Access-Jwt-Assertion": "forged" } },
    );
    assert.equal(forbidden.status, 403);
    clean(await forbidden.text());
    const anonymous = await mf.dispatchFetch(
      "https://probe.example/api/owner/costs",
    );
    assert.equal(anonymous.status, 403);
    const ordinary = await mf.dispatchFetch(
      "https://probe.example/api/owner/costs",
      {
        headers: {
          "Cf-Access-Jwt-Assertion": await sign("ordinary@example.com"),
        },
      },
    );
    assert.equal(ordinary.status, 403);
    const authorized = await mf.dispatchFetch(
      "https://probe.example/api/owner/costs",
      {
        headers: { "Cf-Access-Jwt-Assertion": await sign("owner@example.com") },
      },
    );
    assert.equal(authorized.status, 200);
    const privateData = (await authorized.json()) as any;
    assert.equal(privateData.servers[0].renewal_price_cny, 350);
    assert.ok(!JSON.stringify(privateData).includes("192.0.2.1"));
    assert.match(authorized.headers.get("Cache-Control") ?? "", /no-store/);
    // An owner's token must not turn a public endpoint into a private one.
    const ownerPublic = await mf.dispatchFetch(
      "https://probe.example/api/probe",
      {
        headers: {
          "Sec-Fetch-Site": "same-origin",
          "Cf-Access-Jwt-Assertion": await sign("owner@example.com"),
        },
      },
    );
    clean(await ownerPublic.text());
    const wsResponse = await mf.dispatchFetch(
      "https://probe.example/api/stream",
      { headers: { Origin: "https://probe.example", Upgrade: "websocket" } },
    );
    assert.equal(wsResponse.status, 101);
    const ws = wsResponse.webSocket!;
    const frame = new Promise<string>((resolve, reject) => {
      ws.addEventListener("message", (e) => resolve(String(e.data)), {
        once: true,
      });
      ws.addEventListener("error", reject, { once: true });
      setTimeout(() => reject(new Error("no frame")), 4000).unref();
    });
    ws.accept();
    const wsText = await frame;
    clean(wsText);
    assert.deepEqual(JSON.parse(wsText), JSON.parse(text));
    ws.close();
  } finally {
    await mf.dispose();
  }
});
