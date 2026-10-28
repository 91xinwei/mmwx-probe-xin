import test from "node:test";
import assert from "node:assert/strict";
import {ipinfoReport,ipinfoURL} from "../worker/ipinfo";
test("IPinfo normalizes anonymous and Lite results without inventing privacy or scores",()=>{
  const ip="8.8.8.8";
  const r=ipinfoReport(ip,{ip,country:"US",city:"Mountain View",org:"AS15169 Google LLC",timezone:"America/Los_Angeles"},"2026-10-28");
  assert.equal(r.asn,"AS15169");assert.equal(r.organization,"Google LLC");assert.deepEqual(r.metrics,[]);assert.equal(r.is_proxy,undefined);
  const lite=ipinfoReport(ip,{ip,asn:"AS15169",as_name:"Google LLC",country:"United States"},"");
  assert.equal(lite.organization,"Google LLC");assert.equal(lite.geography,"United States");
  assert.throws(()=>ipinfoReport(ip,{ip:"1.1.1.1"},""));
  assert.throws(()=>ipinfoReport(ip,{ip,error:"quota"},""));
  assert.throws(()=>ipinfoReport(ip,{ip,bogon:true},""));
  assert.equal(ipinfoURL(ip,"secret"),"https://api.ipinfo.io/lite/8.8.8.8");
  assert.ok(!ipinfoURL(ip,"secret").includes("secret"));
});
