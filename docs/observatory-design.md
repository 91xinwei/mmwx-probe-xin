# Xin Observatory 展示页面

本地项目来源：https://github.com/91xinwei/mmwx-probe-xin ，基于 0ffc6d9。

## 页面入口

- `/`：新版总览，读取实际 `/api/probe` 与 `/api/stream`。
- `/?demo=1`：明确标记的静态演示，供未配置主控时预览；不请求主控。
- `/?view=classic`：保留上游完整视图、历史曲线与高级功能。

## 设计与数据

浅灰画布、白色卡片和青绿色状态标识。移动端单列、桌面三列；支持明暗主题、搜索、地区筛选、在线/离线/告警筛选、CPU/名称排序、列表视图及节点详情。

总览呈现节点数量、地区、当前在线率、在线节点网速及最新返回日期的日流量。在线率只代表当前快照，不代表历史 SLA。资源告警沿用项目已有超过 90% 的规则。卡片显示 CPU、内存、硬盘、双向网速与第一探测目标的延迟摘要。缺失数据为“—”；离线节点隐藏实时指标。点击详情可查看规格、系统、计费用量与到期信息。

目前没有主控配置与真实快照，演示的地区、供应商、节点、规格及指标均为设计样例。真实字段继续使用已有 ProbePayload / ProbeServer 类型与 Worker 代理；密钥由 Worker 保存。

## 官方依据

- https://miaomiaowux.com/docs/probe-api/ ：快照、WebSocket、历史序列、字段缺省规则。
- https://miaomiaowux.com/docs/custom-css/ ：主控自定义 CSS 属于另一种外观注入机制，并非独立前端部署方式。
- https://miaomiaowux.com/docs/install-external-probe/ ：Cloudflare Worker 的静态页面与只读代理部署。

本地预览：`npm ci && npm run dev`，打开 `http://localhost:5173/?demo=1`。连接真实数据需按 README 配置 `.dev.vars` 并启动 Wrangler。不要将 PROBE_TOKEN 写入前端。

## V2 实现（2026-10-25）

已完成暖白金色新版布局，增加上海三网 IPv4/IPv6 延迟与丢包、按协议区分的异常标识、三网历史/丢包时间轴、系统资源历史、整机TCP/UDP历史、每日流量、回程检测、解锁检测和转发链视图。地区按国家归并，低速网络按B/KB/MB自适应显示，不将小于1MB/s的速率误显示成0。

通过当前线上公开接口实测11台节点和3条转发链，详见 server-capabilities.md。新版Worker过滤公开成本，并提供受Cloudflare Access验证的所有者成本接口；配置步骤见 owner-access.md。未部署，线上旧接口的成本字段仍会返回。

本地根路径支持已过滤的真实公开数据预览；`?demo=1`仍为明确标记的虚构数据，不用于证明真实能力。IP质量缺乏出口IP与第三方评分数据源，暂仅展示未接入和来源入口。没有将已有解锁结果当作IP信誉分。

提交检查点：新版页面按用户最新要求移除转发链展示；科技感设计和3D地球仍待候选方案选择。第三方IP质量仅完成来源可行性核查，尚未生产接入。
