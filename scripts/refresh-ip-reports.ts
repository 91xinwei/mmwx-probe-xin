import { readFile, writeFile, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ipinfoReport, ipinfoURL } from "../worker/ipinfo";
import type { IPReportPayload } from "../src/ip-reports";
const runFile = promisify(execFile);
const root = new URL("../", import.meta.url);
const path = new URL("src/data/ip-reports.json", root);
const nodes = JSON.parse(await readFile(new URL("src/data/node-ip-map.json", root), "utf8")) as {name:string;ip:string}[];
if (process.env.IP_REPORTS_SKIP_REFRESH === "1") {
  console.log("IP reports: offline build uses saved snapshots.");
} else {
  const payload = JSON.parse(await readFile(path, "utf8")) as IPReportPayload;
  const token = process.env.IPINFO_TOKEN;
  const queue = [...new Set(nodes.map(n => n.ip))];
  let successes=0, failures=0;
  const refreshed = new Map<string, import("../src/ip-reports").IPReport>();
  async function query(ip: string) {
    const url=ipinfoURL(ip,token);
    try {
      const response=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{Accept:"application/json"},signal:AbortSignal.timeout(8000)});
      if(!response.ok) throw Error("Lookup failed");
      return await response.json();
    } catch {
      // Local Node may not use the workstation's proxy; curl does. Never pass
      // credentials as CLI arguments, and never fetch private owner endpoints.
      if(token) throw Error("Authenticated lookup unavailable");
      const {stdout}=await runFile("curl",["-fsS","--max-time","10",url],{maxBuffer:1024*1024});
      return JSON.parse(stdout);
    }
  }
  async function worker() {
    while(queue.length) {
      const ip=queue.shift()!;
      try {
        const report=ipinfoReport(ip,await query(ip),new Date().toISOString());
        refreshed.set(ip,{...report,node_names:nodes.filter(n=>n.ip===ip).map(n=>n.name)});
        successes++;
      } catch { failures++; }
    }
  }
  await Promise.all(Array.from({length:3},worker));
  // Keep the original observation date and data when a refresh fails.
  payload.reports=payload.reports.filter(r=>r.source!=="ipinfo" || !refreshed.has(r.ip));
  payload.reports.unshift(...refreshed.values());
  const temp=new URL("src/data/ip-reports.json.tmp",root);
  await writeFile(temp,JSON.stringify(payload,null,2)+"\n");
  await rename(temp,path);
  console.log(`IP reports refreshed: ${successes}/${nodes.length} verified; ${failures} unavailable (saved data retained).`);
}
