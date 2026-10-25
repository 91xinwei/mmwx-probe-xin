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
