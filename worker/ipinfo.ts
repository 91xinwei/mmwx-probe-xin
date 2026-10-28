import type { IPReport } from "../src/ip-reports";
export function ipinfoReport(ip: string, input: unknown, observedAt: string): IPReport {
  if (!input || typeof input !== "object") throw Error("Invalid IPinfo response");
  const v = input as Record<string, unknown>;
  if (v.ip !== ip || v.error || v.bogon === true) throw Error("IPinfo IP mismatch or unavailable");
  const text=(key:string)=>typeof v[key]==="string" && v[key] ? v[key] as string : undefined;
  const org=text("org");
  const attributes: {label:string;value:string}[]=[];
  for(const [key,label] of [["hostname","主机名"],["timezone","IP 时区"],["postal","邮编"],["as_domain","ASN 域名"]]) {
    const value=text(key); if(value) attributes.push({label,value});
  }
  if(typeof v.anycast === "boolean") attributes.push({label:"Anycast",value:v.anycast?"是":"否"});
  // Only display explicit signals returned by the subscribed API tier.
  const privacy=v.privacy && typeof v.privacy==="object" ? v.privacy as Record<string,unknown> : {};
  for(const [key,label] of [["vpn","VPN"],["proxy","代理"],["tor","Tor"],["relay","中继"],["hosting","机房"]]) {
    if(typeof privacy[key]==="boolean") attributes.push({label,value:privacy[key]?"是":"否"});
  }
  return {id:`ipinfo-${ip}`,ip,source:"ipinfo",source_name:"IPinfo",report_url:`https://ipinfo.io/${encodeURIComponent(ip)}`,
    observed_at:observedAt,collection:"api",geography:[text("country"),text("region"),text("city")].filter(Boolean).join(" · ") || undefined,
    asn:text("asn") ?? org?.match(/^AS\d+/)?.[0],organization:text("as_name") ?? org?.replace(/^AS\d+\s*/,""),
    attributes,metrics:[],is_proxy:typeof privacy.proxy==="boolean"?privacy.proxy:undefined,refresh_status:"ok"};
}
export function ipinfoURL(ip:string, token?:string) {
  return token ? `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}` : `https://ipinfo.io/${encodeURIComponent(ip)}/json`;
}
