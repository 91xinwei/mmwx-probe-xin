# IP质量数据源核查与接入设计

2026-10-25。用户指定 IPPure、IP2Location、ip.net.coffee。仅核查文档，并用IP2Location官方示例地址8.8.8.8做无密钥请求；未向第三方提交用户节点IP，未声称已完成生产接入。

## IPPure（ippure.com）

官方公开API：https://my.ippure.com/v1/info 。文档：https://ippure.com/MyIP-Info-API 。返回调用API的出口地址资料，含ip/asn/asOrganization、国家/地区/城市、经纬度、fraudScore、isResidential、isBroadcast。文档标注测试阶段可能变化。

限制：它是调用方IP查询，不是已确认的任意IP批量接口。由Cloudflare Worker直接调用会测到Worker出口，不能当成11台VPS结果。必须从各节点或具体代理出口发起采集，再安全上报缓存。多网卡/多落地、IPv4与IPv6分别绑定。官方FAQ明确IPv6不计算IPPure系数，缺失应显示不支持，不能显示0或纯净。

评分方向：越大风险越高。保留原始“IPPure风险系数”，不能直接标为“纯净度越高越好”。Cloudflare机器人风控分与IPPure一般风险不是同一指标，前者也不能任意查询其他IP。

## IP2Location.io

官方推荐新集成使用ip2location.io（旧IP2Location Web Service不再接收新注册）。

文档：https://www.ip2location.io/ip2location-documentation
价格/套餐：https://www.ip2location.io/pricing
API：https://api.ip2location.io/?ip={ip} ，支持指定IPv4/IPv6；可按文档使用Bearer Key，密钥仅服务端保存。

实测8.8.8.8无密钥返回基础定位、ASN/AS、is_proxy等，没有fraud_score和详细proxy对象。不要承诺免费套餐具备完整风险分。完整套餐文档提供usage_type、ISP、proxy各类标记以及IP2Proxy fraud_score；具体能力以套餐返回为准。fraud_score是0–99，越大风险越高。免费计划要求来源署名；缓存与公开展示遵循该API服务条款，不能套用数据库产品许可作结论。

信息展示：国家/城市、ASN与网络组织、住宅/移动/机房用途、VPN/Tor/代理等标记，分别注明来源与检测时间。字段缺失表示未提供，不可当作false。

## Net.Coffee

官网：https://ip.net.coffee/ ，评分页：https://ip.net.coffee/ip/ ，Claude页：https://ip.net.coffee/claude/ 。官网介绍包括地理/ASN/运营商、住宅或机房、人机流量、多源比对、滥用/黑名单、网络检测。

本轮未找到公开、正式的第三方API文档、配额或授权接入说明，不能宣称没有API，也不能宣称已可自动接。先提供来源网页入口；自动同步需得到官方可用API与规则。页面可查询不等于可稳定批量抓取。未确认URL参数格式时，不编造任意IP报告深链。

## 展示与采集架构

- 将节点与实际出口IP关联；现有公开探针没有IP和稳定ID，不能靠名称猜测、用数组下标做长期绑定。
- IPPure：节点/实际代理出口 → 其调用方IP API → 受认证的上报通道 → 服务端缓存。
- IP2Location：服务端用已知真实出口IP发起指定IP查询 → 缓存 → 摘要白名单输出。
- Net.Coffee：来源入口；正式API待确认。
- 初始建议每日一次并在IP变更时重查，不跟随探针5秒刷新。失败与过期独立显示，不生成伪分数。
- 公开节点卡片显示网络类型/ASN、源名称与风险摘要、更新时间；完整IP、具体报告深链与管理信息默认仅所有者可见。隐藏文字但URL含IP仍会暴露地址。
- 不把三个来源平均成无定义的“纯净度”；显示原始风险分和分值方向。需要统一等级时，应单独公布映射规则并保留源结果。

## 当前视觉约束

用户新增要求：科技感、3D地球、每节点CPU与内存、上海三网延迟及丢包；不展示转发链。最近修订概念图按聊天实际显示顺序为：

1. 深空青蓝表格：/Users/weixin/.codex/generated_images/01a171d4-5141-75c3-b4e8-2f342bdc8546/exec-e6505a13-0203-4d5f-93ff-453a6da158db.png
2. 浅色蓝白仪表：/Users/weixin/.codex/generated_images/01a171d4-5141-75c3-b4e8-2f342bdc8546/exec-0b638dd9-f6a3-4f89-a6c7-ff47d3c1f90f.png
3. 暗色翡翠节点卡：/Users/weixin/.codex/generated_images/01a171d4-5141-75c3-b4e8-2f342bdc8546/exec-9dea549c-34fc-4ab5-8079-77206f801362.png

这三张均为视觉概念，不是运行截图；图内数据/地理标记不用于推导实测结论。待用户选择后再按真实数据实现。新版源码已移除转发链入口和展示；原有视图与接口兼容性保留。

## 已实现的报告展示（2026-10-25）

`?tab=ip` 展示显式收录的 `24.249.30.27`，每份报告保留来源链接、读取日期和来源自身的评分口径。IPLense 使用当天已读取的页面快照：综合评分 98/100（高为好）、风险值 1/100（低为好）；ASN 流量比例明确标注为 ASN 级统计。没有实现 IPLense 自动抓取。

`/api/ip-reports` 查询 IP2Location.io 的已收录 IP，成功缓存一小时，失败保留原快照及原时间、短缓存一分钟。可选 Worker secret `IP2LOCATION_API_KEY` 用于官方 API；无密钥时只展示官方返回的基本信息，未返回的评分不会补零。IPPure、Net.Coffee 暂时显示查询入口和未取得结果。

新增报告在 `src/data/ip-reports.json` 配置；只查询显式收录地址，不提供任意 IP 代理。节点关联必须通过 `node_names` 显式填写，未关联的报告只出现在独立报告区。此变更尚未部署到线上 Worker。

## Net.Coffee Claude IP 接入（2026-10-28）

用户明确要求全部已关联节点接入 https://ip.net.coffee/claude/ 。阅读该页自身公开脚本 `/claude/claude-page.js?v=20260916a`，确认网页使用 `/api/iprisk/{IP}` 读取 trust_score、地理、ASN、住宅/机房、VPN/代理/Tor/爬虫/滥用等字段。以 8.8.8.8 实测响应。此为网页使用的接口，尚未发现版本化 API 文档或 SLA，不能承诺长期稳定。

已对全部 11 个登记节点进行一次查询；仅 1 个返回地址匹配的有效数据，其他查询失败或返回不同地址。不得将源站返回的其他 IP 的分数重新标注到请求 IP：接入严格校验响应 IP，不匹配则保留旧快照或显示未取得结果。全部 11 个有报告与状态，只有已验证结果有分数。

`worker/ip-reports.ts` 增加 Net.Coffee 适配器，生产刷新与原 IP2Location 一同使用服务端一小时缓存（v3）；本地开发只读适配器同步接入。分数保留原名与方向，说明为 Net.Coffee 评价，非 Anthropic 官方评分或服务可用保证。未知布尔值显示未提供，不转为否。报告覆盖来源实际返回的网络属性、安全标记、时区、反向 DNS、RPKI 和原始滥用指标；不执行页面脚本、不上传浏览器会话。

Claude 页自动检测的是访问者当前出口，链接不包含节点深链参数；来源按钮明确写“打开原站自测”。DNS/WebRTC/指纹和客户端连通性不是远程 VPS 查询结果，不纳入节点报告。登记 IP 取自主控地址，尚未独立核验为代理实际出口。

用户确认 owner 限制仅用于 VPS 成本、套餐周期、到期与续费，而非 IP 报告。新版补充 owner 专属套餐与续费摘要；公开接口继续剔除敏感续费字段。

## IPinfo 指定 IP 查询落地（2026-10-28）

用户要求寻找 IPinfo 等替代方式。核查官方 Lite / Privacy 文档后，实测 `https://ipinfo.io/{IP}/json` 匿名端点可用；对全部 11 个登记节点逐一查询，11/11 返回 IP 精确匹配的资料。已保存真实返回的 IPinfo 快照、来源与查询时间，不替代或伪造 Net.Coffee 分数。

- 基础字段：按实际响应展示国家/地区/城市、ASN、网络机构、主机名、IP 时区、邮编、Anycast 等。它们不是住宅真实性或 Claude 可用性的验证。
- `worker/ipinfo.ts` 统一解析匿名和 Lite 数据，验证响应 IP、error、bogon；没有显式返回的 VPN/代理等标记不补为 false，不构造综合分。
- 生产 IP 报告增加 IPinfo 查询、v4 一小时缓存与失败保留快照。匿名端点属于限流的非认证能力，不承诺额度或持续可用性。
- 可选 Worker Secret `IPINFO_TOKEN`：配置后改用正式 `https://api.ipinfo.io/lite/{IP}`，Authorization Bearer 仅服务端使用，不写入 URL/前端/快照。免费 Lite 提供国家/洲与基础 ASN，不保证城市、时区或 VPN/代理/机房详情。匿名快照中的旧字段不会伪装成新的 Lite 实时返回字段。
- 付费 IPinfo Core/Plus/Privacy 的检测能力需相应订阅，本轮未购买或声称已接通。参考 https://ipinfo.io/developers/lite-api 与 https://ipinfo.io/developers/ip-privacy-detection-api-data 。
- 本地开发支持匿名 IPinfo 刷新；新版 IP 页面保留各来源单独报告和结果状态。

## 每次发布的资料更新（2026-10-28）

`npm run build` 的 `prebuild` 自动运行 `npm run refresh:ip`，包含 GitHub CI、Cloudflare 的标准构建命令以及本地 `npm run deploy`。脚本只查询已登记公开节点，最多 3 个并发，超时后保留已有报告与原观测时间；不阻断其余节点或发布。结果写入构建使用的 `src/data/ip-reports.json`，不会自动提交回 Git。需要离线构建时设置 `IP_REPORTS_SKIP_REFRESH=1`。

本轮发布刷新实测 11/11 成功。有 `IPINFO_TOKEN` 时使用正式 Lite；无 token 使用已验证可用的匿名查询，仍可能限流，不承诺永远可用。本地 Node 不采用系统代理时，匿名查询回退 curl；凭据不进入命令参数、报告或日志。

| 信息 | 刷新方式 | 能力边界 |
| --- | --- | --- |
| IP 地区、ASN、网络机构、主机名、时区、邮编、Anycast | 每次构建刷新 IPinfo，线上报告接口也可刷新 | 仅显示实际返回字段；Lite 不保证城市等细节 |
| IP2Location 基础归属 | 线上报告接口现有刷新 | 未授权套餐字段不推断 |
| Net.Coffee 现有有效评分 | 线上报告接口核验后刷新 | 源返回不同 IP 时拒绝，不作为发布必需来源 |
| CPU、内存、磁盘、速率、连接、三网 | 原有 API/WebSocket 实时更新 | 不在构建期固化为实时值 |
| VPS 成本、套餐、到期、续费 | owner 登录后私有接口更新 | 不写入公开构建文件，需要 Access 认证和主控已有字段 |
| 住宅属性、VPN/Tor、风险/信任评分 | 只有来源实际提供才显示 | 不用基础 ASN 推断，不合成“纯净度” |
| 付款历史、实际代理出口、浏览器指纹、DNS/WebRTC | 当前无逐节点有效来源 | 不展示为节点检测结果 |

IP 页面仅展示带观测时间和有效字段的报告，隐藏空失败报告、未提供属性和未接入来源占位。成功取得过的旧数据可保留，更新失败仍注明，绝不刷新伪时间。
