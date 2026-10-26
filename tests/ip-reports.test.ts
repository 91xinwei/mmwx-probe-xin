import snapshot from "../src/data/ip-reports.json";
import nodeMap from "../src/data/node-ip-map.json";
import test from "node:test";
import assert from "node:assert/strict";
import {
  ip2LocationReport,
  loadIPReports,
  publishedIPs,
} from "../worker/ip-reports";
import { linkedReports, metricText, reportLink } from "../src/ip-reports";
const ip = "24.249.30.27";
const input = {
  ip,
  country_name: "United States",
  region_name: "Nevada",
  city_name: "Las Vegas",
  asn: "22773",
  as: "Cox Communications Inc.",
  is_proxy: false,
};
test("report parsing retains observed facts without inventing a risk score or treating missing proxy as false", () => {
  const r = ip2LocationReport(ip, input, "2026-10-25T09:00:00Z");
  assert.equal(r.asn, "AS22773");
  assert.equal(r.is_proxy, false);
  assert.deepEqual(r.metrics, []);
  assert.equal(ip2LocationReport(ip, { ip }, "2026-10-25").is_proxy, undefined);
  assert.deepEqual(
    ip2LocationReport(ip, { ...input, fraud_score: "0" }, "2026-10-25").metrics,
    [],
  );
  const zero = ip2LocationReport(
    ip,
    { ...input, fraud_score: 0 },
    "2026-10-25",
  );
  assert.equal(zero.metrics[0].value, 0);
  assert.equal(zero.metrics[0].direction, "lower_is_better");
  for (const bad of [-1, 100, Infinity])
    assert.deepEqual(
      ip2LocationReport(ip, { ...input, fraud_score: bad }, "2026-10-25")
        .metrics,
      [],
    );
  assert.throws(() =>
    ip2LocationReport(ip, { ...input, ip: "1.1.1.1" }, "2026-10-25"),
  );
});
test("refresh only visits explicitly published IPs; failures preserve original read date and distinguish metrics", async () => {
  const visited: string[] = [];
  const payload = await loadIPReports(
    async (target) => {
      visited.push(target);
      return { ...input, ip: target };
    },
    () => "2026-10-25T09:00:00Z",
  );
  assert.deepEqual(visited, publishedIPs);
  const page = payload.reports.find((r) => r.source === "iplense")!;
  assert.equal(page.metrics[0].value, 98);
  assert.equal(page.metrics[0].direction, "higher_is_better");
  assert.equal(page.metrics[1].value, 1);
  assert.equal(page.metrics[1].direction, "lower_is_better");
  assert.ok(page.asn_traffic);
  const failed = await loadIPReports(
    async () => {
      throw new Error("timeout");
    },
    () => "2099-01-01",
  );
  const fallback = failed.reports.find((r) => r.source === "ip2location")!;
  assert.equal(fallback.refresh_status, "failed");
  assert.equal(
    fallback.observed_at,
    snapshot.reports.find((r) => r.id === fallback.id)!.observed_at,
  );
  assert.deepEqual(fallback.metrics, []);
});
test("source links require HTTPS and their own domain; reports cannot be attached to arbitrary nodes by name", async () => {
  const { reports } = await loadIPReports(async () => input);
  const r = reports[0];
  assert.equal(reportLink(r), "https://iplense.cc/zh/ip/24.249.30.27");
  for (const url of [
    "javascript:alert(1)",
    "http://iplense.cc/",
    "https://iplense.cc.evil.example/",
    "https://user:pass@iplense.cc/",
    "https://other.example/",
  ])
    assert.equal(reportLink({ ...r, report_url: url }), undefined);
  assert.equal(linkedReports(reports).length, snapshot.reports.length);
  assert.equal(linkedReports(reports, "NOVIXLINK-美西-COX家宽").length, 2);
  assert.deepEqual(linkedReports(reports, "unconfirmed-node"), []);
  assert.deepEqual(
    linkedReports([{ ...r, node_names: ["confirmed-node"] }], "confirmed-node"),
    [{ ...r, node_names: ["confirmed-node"] }],
  );
  assert.equal(metricText({ ...r.metrics[0], value: -1 }), "未获取");
});

test("every confirmed node keeps its own IP after API refresh and failure", async () => {
  const refreshed = await loadIPReports(async (ip) => ({ ...input, ip }));
  const failed = await loadIPReports(async () => {
    throw new Error("offline");
  });
  assert.equal(nodeMap.length, 11);
  for (const node of nodeMap) {
    for (const payload of [refreshed, failed]) {
      const matched = linkedReports(payload.reports, node.name);
      assert.ok(matched.length > 0);
      assert.ok(matched.every((r) => r.ip === node.ip));
    }
  }
});
