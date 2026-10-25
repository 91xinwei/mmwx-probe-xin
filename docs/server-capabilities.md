# 当前服务端能力核查

核查日期：2026-10-25（北京时间）。对象：用户提供的 `mmwx-probe.weixin372982054.workers.dev` 的只读公开代理。以下基于本轮实际 JSON 响应，不代表已审计主控全部管理接口或源代码。原始成本数值不保存到此报告。

## 已实测

| 能力 | 实际情况 | 页面可直接使用 |
| --- | --- | --- |
| 节点快照 | 11 台 | 在线、地区、系统规格、资源占用、速率 |
| 上海三网 | 11/11 台含电信、联通、移动 | 各自延迟、丢包、近1h小图 |
| 三网配置 | enabled=true；key 为 sh-ct-v4、sh-cu-v4、sh-cm-v4 | 按 key 关联，不猜名称 |
| 延迟历史 | server=0 的 all=1 请求成功，22 个目标，1h 12 桶，桶宽300秒 | 三网默认展示、国际目标按需展开 |
| 历史保留期 | history_days=7 | 1h/6h/24h/3d/7d，按返回开关使用 |
| 系统历史 | server=0 请求成功，每项12点 | CPU、内存、磁盘、网速、累计流量、TCP/UDP |
| 每日流量 | 11/11 台非空 | 日期、上行、下行、合计 |
| 周期计费流量 | 11/11 台有字段 | 规则、流量源、对账调整、已用/限额、周期范围 |
| 连接数历史 | 11/11 台均有TCP/UDP，各12格 | 整机连接趋势，非用户数 |
| 三网回程 | 11/11 台非空 | carrier、region、route_type、tested_at |
| 解锁检测 | 11/11 台非空 | service、status、region、tested_at |
| 转发链 | 快照 forward 与 /api/forward 均有3条 | 端到端延迟、丢包、分组、健康状态、可用率、抖动、状态条与趋势 |
| 服务商链接 | 4/11 台有 | 其余是未填写，不能据此判服务端不支持 |
| VPS续费 | 11/11 台下发价格/币种/周期/人民币价 | 应仅进入所有者视图 |

实测根字段还包括 `show_forward`、多项 `show_*`、appearance、icon、logo、title；其中展示开关目前为 true。show_* 是展示配置，不等于所有指标一定有有效样本。

## 特别发现：线上成本公开

当前线上 /api/probe 在公开访问路径中下发 `renewal_price`、`renewal_price_cny`、`renewal_currency`、`renewal_cycle` 和 `expires_at`。页面不画金额并不能保证成本私有。仓库新版已在 Worker 中对公开 HTTP 和 WS 使用相同白名单过滤，并单设验证所有者身份的成本接口；未部署前，线上行为不会改变。

## 尚未看到的能力

当前公开响应没有服务器 IP、稳定服务器 ID、IP信誉/欺诈风险/黑名单评分，也没有首次购买价格和实际付款流水。主控文档支持管理服务器地址和按 IPInfo 填地区，但地区识别不等于风险评分。

因此：基础监控、三网、回程、解锁、转发、续费价格无需另造采集器；IP质量分与付款历史需要额外数据源。主控本身有IP不代表公开探针允许返回IP；如进一步扩展应从受保护的服务端数据或Agent出口上报获取，不从前端猜测。尚未登录主控，不能断言其私有管理接口完全不支持。

## 使用的实际接口

- GET /api/probe
- GET /api/series?server=0&all=1&range=1h
- GET /api/series?server=0&metric=system&range=1h
- GET /api/forward

系统历史响应的 `series` 含 cpu_pct、mem_used、mem_total、disk_used、disk_total、upload_speed、download_speed、cumulative_up、cumulative_down、tcp_connections、udp_connections。顶层 buckets 是数量，不是数组。

解锁状态实测有 yes/no/originals_only/banned/failed，不能把未知/失败显示成已解锁。当前检测包含 OpenAI、Claude、Gemini、Netflix、Disney+、YouTube 等；连通性 ping 与解锁字段要区分。

## 官方依据

- https://miaomiaowux.com/docs/probe-api/
- https://miaomiaowux.com/docs/remote-servers/

本轮仅直接验证首台服务器的历史接口，不能据此宣称所有节点7天历史均完整。11台的快照数组覆盖率已经逐台检查。
