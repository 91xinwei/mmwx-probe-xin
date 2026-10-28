import {lazy,Suspense,useEffect,useState} from "react";
import {Activity,Globe2,Pause,Play,ArrowDown,ArrowUp} from "lucide-react";
import {ResponsiveContainer,RadialBarChart,RadialBar,PolarAngleAxis,AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip} from "recharts";
import type {ProbePayload} from "./types";
import {memPct,diskPct} from "./probe-overview";
import {formatBytes,hasIssue} from "./observatory-data";
const Globe=lazy(()=>import("./CommandGlobe").then(m=>({default:m.CommandGlobe})));
type Sample={time:string;down:number|null;up:number|null};
function Gauge({label,value,color}:{label:string;value?:number;color:string}) {
 return <article className="command-gauge"><span>{label}</span><div className="command-dial"><ResponsiveContainer width="100%" height="100%"><RadialBarChart data={[{value:value??0,fill:color}]} innerRadius="76%" outerRadius="94%" startAngle={225} endAngle={-45} barSize={8}><PolarAngleAxis type="number" domain={[0,100]} tick={false}/><RadialBar dataKey="value" background={{fill:"#183048"}} cornerRadius={5} isAnimationActive={false}/></RadialBarChart></ResponsiveContainer><strong style={{color}}>{value===undefined?"—":`${value.toFixed(1)}%`}</strong></div><small>在线节点平均 · 仅已上报样本</small></article>;
}
export function CommandHero({data,updatedAt,isDemo}:{data?:ProbePayload;updatedAt?:number;isDemo:boolean}) {
 const servers=data?.enabled?data.servers??[]:[];
 const online=servers.filter(s=>s.online);
 const average=(values:(number|undefined)[])=>{const known=values.filter((v):v is number=>v!==undefined&&Number.isFinite(v));return known.length?known.reduce((a,b)=>a+b,0)/known.length:undefined;};
 const sum=(key:"download_speed"|"upload_speed")=>{const values=online.flatMap(s=>s[key]===undefined?[]:[s[key]!]);return values.length?values.reduce((a,b)=>a+b,0):undefined;};
 const down=sum("download_speed"),up=sum("upload_speed");
 const [spinning,setSpinning]=useState(true);
 const [samples,setSamples]=useState<Sample[]>(()=>isDemo?Array.from({length:24},(_,i)=>({time:`${String(Math.floor(i/6)).padStart(2,"0")}:${String(i%6*10).padStart(2,"0")}`,down:(down??0)/1e6*(.6+.3*Math.sin(i*.8)**2),up:(up??0)/1e6*(.5+.3*Math.sin(i*.6)**2)})):[]);
 useEffect(()=>{if(isDemo||!updatedAt)return;setSamples(old=>[...old,{time:new Date(updatedAt).toLocaleTimeString("zh-CN",{hour12:false}),down:down===undefined?null:down/1e6,up:up===undefined?null:up/1e6}].slice(-40));},[updatedAt,isDemo,down,up]);
 return <section className="command-hero" aria-label="全球网络指挥舱">
  <div className="command-earth"><div className="command-earth-heading"><span><Globe2 size={15}/> GLOBAL COVERAGE</span><span>{isDemo?"DEMO":"LIVE"}</span></div><Suspense fallback={<div className="ob-empty">正在加载三维地球…</div>}><Globe regions={servers.map(s=>s.region??"")} spinning={spinning}/></Suspense><div className="command-earth-footer"><button onClick={()=>setSpinning(!spinning)} aria-pressed={spinning}>{spinning?<Pause size={14}/>:<Play size={14}/>} {spinning?"暂停自转":"开启自转"}</button><small>拖动旋转 · 地区代表点，非机房精确坐标</small></div></div>
  <div className="command-instruments"><div className="command-heading"><div><span>NETWORK / COMMAND CENTER</span><h1>全球节点状态</h1></div><span className="command-live"><i/>{isDemo?"演示数据":"实时遥测"}</span></div>
  <div className="command-summary"><div><strong>{data?online.length:"—"}<small> / {servers.length}</small></strong><span>在线节点</span></div><div><strong className="command-alert">{data?servers.filter(s=>hasIssue(s,data)).length:"—"}</strong><span>异常节点</span></div><div><strong>{formatBytes(down)}<small>/s</small></strong><span>实时下行</span></div><div><strong>{formatBytes(up)}<small>/s</small></strong><span>实时上行</span></div></div>
  <div className="command-gauges"><Gauge label="CPU 使用率" value={average(online.map(s=>s.cpu_pct))} color="#60e7ff"/><Gauge label="内存使用率" value={average(online.map(memPct))} color="#91a6ff"/><Gauge label="磁盘使用率" value={average(online.map(diskPct))} color="#f1be68"/></div>
  <div className="command-traffic"><div className="command-chart-heading"><h2><Activity size={15}/>网络流量 <small>{isDemo?"演示趋势":"本次会话 · 最近40次快照"}</small></h2><div><span><ArrowDown size={12}/>{formatBytes(down)}/s</span><span><ArrowUp size={12}/>{formatBytes(up)}/s</span></div></div>{samples.length>1?<div className="command-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={samples} margin={{left:0,right:10,top:10,bottom:0}}><CartesianGrid stroke="#244057" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" minTickGap={65} tick={{fill:"#8098ad",fontSize:10}} axisLine={false} tickLine={false}/><YAxis width={36} tick={{fill:"#8098ad",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#091827",border:"1px solid #31516e",borderRadius:8,color:"#ddecf7"}} formatter={(v)=>`${Number(v).toFixed(2)} MB/s`}/><Area dataKey="down" name="下行" type="monotone" stroke="#91a6ff" fill="#91a6ff" fillOpacity={.12} isAnimationActive={false} connectNulls={false}/><Area dataKey="up" name="上行" type="monotone" stroke="#efbd65" fill="#efbd65" fillOpacity={.06} isAnimationActive={false} connectNulls={false}/></AreaChart></ResponsiveContainer></div>:<div className="command-chart ob-empty">等待实时流量样本，连接后自动绘制</div>}</div></div>
 </section>;
}
