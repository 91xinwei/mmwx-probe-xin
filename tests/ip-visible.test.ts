import test from "node:test";
import assert from "node:assert/strict";
import {hasReportData,type IPReport} from "../src/ip-reports";
test("empty failures stay hidden; observed results remain usable",()=>{
  const r:IPReport={id:"x",ip:"8.8.8.8",source:"ipinfo",source_name:"IPinfo",report_url:"https://ipinfo.io/8.8.8.8",observed_at:"",collection:"api",metrics:[],refresh_status:"failed"};
  assert.equal(hasReportData(r),false);
  assert.equal(hasReportData({...r,observed_at:"2026-10-28",attributes:[{label:"VPN",value:"未提供"}]}),false);
  assert.equal(hasReportData({...r,observed_at:"2026-10-28",asn:"AS15169"}),true);
});
