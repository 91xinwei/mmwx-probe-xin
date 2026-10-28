import test from "node:test";
import assert from "node:assert/strict";
import { netCoffeeReport, loadIPReports, publishedIPs } from "../worker/ip-reports";

test("Net.Coffee preserves score direction, unknown flags and source attribution", () => {
  const ip="8.8.8.8";
  const r=netCoffeeReport(ip,{ip,trust_score:0,is_proxy:false,is_vpn:true,isResidential:null,asn:15169,country:"United States"},"2026-10-28T00:00:00Z");
  assert.equal(r.metrics[0].value,0);
  assert.equal(r.metrics[0].direction,"higher_is_better");
  assert.equal(r.is_proxy,false);
  assert.equal(r.attributes?.find(x=>x.label==="住宅属性")?.value,"未提供");
  assert.equal(r.attributes?.find(x=>x.label==="VPN")?.value,"是");
  assert.equal(r.asn,"AS15169");
  assert.equal(r.report_url,"https://ip.net.coffee/claude/");
  for(const score of ["100",-1,101,NaN,Infinity]) assert.deepEqual(netCoffeeReport(ip,{ip,trust_score:score},"").metrics,[]);
  assert.throws(()=>netCoffeeReport(ip,{ip:"1.1.1.1"},""));
  assert.throws(()=>netCoffeeReport(ip,{ip,error:"Unavailable"},""));
});

test("every published node receives its own Net.Coffee report; failures do not invent scores",async()=>{
  const queried:string[]=[];
  const reports=await loadIPReports(async ip=>({ip}),()=>"2026-10-28T00:00:00Z",async ip=>{queried.push(ip);return {ip,trust_score:75};});
  assert.deepEqual(queried,publishedIPs);
  const coffee=reports.reports.filter(r=>r.source==="netcoffee");
  assert.equal(coffee.length,publishedIPs.length);
  assert.ok(coffee.every(r=>r.node_names?.length));
  const failed=await loadIPReports(async ip=>({ip}),()=>"2099-01-01",async()=>{throw Error("timeout");});
  assert.equal(failed.reports.filter(r=>r.source==="netcoffee").length,publishedIPs.length);
  assert.ok(failed.reports.filter(r=>r.source==="netcoffee").every(r=>r.refresh_status==="failed" && r.observed_at!=="2099-01-01"));
});
