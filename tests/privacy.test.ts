import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import {
  publicSnapshot,
  publicFrame,
  publicResponse,
} from "../worker/public-data";
import { isOwner } from "../worker/owner-auth";
import { shanghaiRows, hasIssue } from "../src/observatory-data";
const privateServer = {
  name: "node",
  online: true,
  renewal_price: 100,
  renewal_price_cny: 700,
  renewal_currency: "USD",
  renewal_cycle: "year",
  expires_at: "2026-11-01",
  ip: "192.0.2.1",
  purchase_price: 120,
  future_billing: { amount: 1000 },
  cpu_pct: 0,
  ping: [
    {
      key: "sh",
      label: "上海电信",
      isp: "telecom",
      current_ms: 0,
      loss_pct: 0,
      buckets: [{ ms: 0, loss: 0, price: 100 }],
    },
  ],
};
const raw = {
  enabled: true,
  servers: [privateServer],
  total_cost: 1000,
  appearance: { theme: "flat", cost: 1000 },
  forward: [
    {
      name: "chain",
      price: 1000,
      groups: [
        {
          name: "group",
          role: "entry",
          servers: [{ name: "relay", price: 700, healthy: true }],
        },
      ],
    },
  ],
};
test("HTTP and WebSocket snapshots share one public projection and remove costs at every nesting level", () => {
  const http = publicSnapshot(raw);
  const ws = JSON.parse(publicFrame(JSON.stringify(raw)));
  assert.deepEqual(http, ws);
  const text = JSON.stringify(http);
  for (const secret of [
    "renewal_",
    "purchase_",
    "total_cost",
    "expires_at",
    "192.0.2.1",
    "future_billing",
    "price",
  ])
    assert.ok(!text.includes(secret), secret);
  assert.equal((http.servers as any[])[0].cpu_pct, 0);
  assert.equal((http.servers as any[])[0].ping[0].current_ms, 0);
  assert.equal((http.servers as any[])[0].ping[0].buckets[0].ms, 0);
  assert.deepEqual(publicSnapshot({ ...raw, enabled: false }), {
    enabled: false,
  });
});
test("invalid frames fail closed, and object values cannot escape through scalar fields", () => {
  for (const v of ["not json", "{}", '{"enabled": "true"}'])
    assert.throws(() => publicFrame(v));
  assert.throws(() => publicFrame(new ArrayBuffer(4)));
  assert.deepEqual(
    publicSnapshot({
      enabled: true,
      title: { price: 123 },
      servers: [{ name: { price: 123 }, online: true }],
    }),
    { enabled: true, servers: [{ online: true }] },
  );
});
test("history and forward APIs preserve contracted data, drop unknown nested fields", () => {
  const history = {
    success: true,
    bucket_sec: 300,
    generated_at: 1,
    series: privateServer.ping[0],
    all_series: privateServer.ping,
    cost: 100,
  };
  const clean = publicResponse("/api/series", history) as any;
  assert.equal(clean.series.buckets[0].ms, 0);
  assert.equal(clean.all_series[0].loss_pct, 0);
  assert.ok(!JSON.stringify(clean).includes("price"));
  assert.ok(!("cost" in clean));
  const system = publicResponse(
    "/api/series",
    {
      success: true,
      series: {
        cpu_pct: [{ t: 1, value: 0, price: 10 }],
        renewal_price: [{ t: 1, value: 100 }],
      },
    },
    "system",
  ) as any;
  assert.deepEqual(system.series, { cpu_pct: [{ t: 1, value: 0 }] });
  assert.ok(
    !JSON.stringify(
      publicResponse("/api/forward", { enabled: true, chains: raw.forward }),
    ).includes("price"),
  );
});
test("owner auth rejects absent, forged, expired, wrong audience/issuer and ordinary users", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const env = {
    ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
    ACCESS_AUD: "owner-app",
    OWNER_EMAIL: "owner@example.com",
  };
  const sign = (
    email: string,
    options: { aud?: string; iss?: string; exp?: number; type?: string } = {},
  ) =>
    new SignJWT({ email, type: options.type ?? "app" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("user")
      .setIssuedAt()
      .setExpirationTime(options.exp ?? Math.floor(Date.now() / 1000) + 60)
      .setIssuer(options.iss ?? env.ACCESS_TEAM_DOMAIN)
      .setAudience(options.aud ?? env.ACCESS_AUD)
      .sign(privateKey);
  const request = (token?: string) =>
    new Request("https://probe.example/api/owner/costs", {
      headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
    });
  assert.equal(await isOwner(request(), env, keys), false);
  assert.equal(await isOwner(request("fake"), env, keys), false);
  assert.equal(
    await isOwner(request(await sign("owner@example.com")), env, keys),
    true,
  );
  for (const token of [
    await sign("ordinary@example.com"),
    await sign("owner@example.com", { aud: "public-app" }),
    await sign("owner@example.com", { iss: "https://evil.example" }),
    await sign("owner@example.com", { exp: 1 }),
    await sign("owner@example.com", { type: "org" }),
  ])
    assert.equal(await isOwner(request(token), env, keys), false);
  assert.equal(
    await isOwner(request(await sign("owner@example.com")), {}, keys),
    false,
  );
  assert.equal(
    await isOwner(
      request(await sign("owner@example.com")),
      { ...env, ACCESS_TEAM_DOMAIN: "https://attacker.example" },
      keys,
    ),
    false,
  );
});
test("Shanghai rows never substitute global or wrong-family targets, preserve zero, and flag packet loss", () => {
  const s = {
    online: true,
    ping: [
      {
        key: "global",
        label: "Google",
        isp: "telecom",
        current_ms: 12,
        loss_pct: 0,
        buckets: [],
      },
      ...privateServer.ping,
    ],
  };
  const data = { enabled: true, servers: [s] };
  const rows = shanghaiRows(s, data, "IPv4");
  assert.equal(rows[0].series?.current_ms, 0);
  assert.equal(rows[1].series, undefined);
  assert.equal(shanghaiRows(s, data, "IPv6")[0].series, undefined);
  assert.equal(
    shanghaiRows({ ...s, online: false }, data, "IPv4")[0].series,
    undefined,
  );
  assert.equal(
    hasIssue(
      { ...s, ping: [{ ...privateServer.ping[0], loss_pct: 9.09 }] },
      data,
    ),
    true,
  );
  assert.equal(hasIssue(s, data), false);
});

test("system history retains disk metrics and bucket count discovered on the live backend", () => {
  const result = publicResponse(
    "/api/series",
    {
      success: true,
      buckets: 12,
      bucket_sec: 300,
      generated_at: 1800000000,
      series: {
        disk_used: [{ t: 1, value: 10 }],
        disk_total: [{ t: 1, value: 100 }],
      },
    },
    "system",
  ) as any;
  assert.equal(result.buckets, 12);
  assert.deepEqual(result.series.disk_used, [{ t: 1, value: 10 }]);
  assert.deepEqual(result.series.disk_total, [{ t: 1, value: 100 }]);
});
