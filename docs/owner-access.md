# 所有者成本访问配置

新版公开 Worker 对 HTTP `/api/probe` 和 `/api/stream` 的每一帧使用相同字段白名单；移除续费金额、币种、周期、到期日期及未知字段，`classic` 页面使用同一接口。历史与转发接口也采用字段白名单。公开流量的“计费用量”是字节数，不是VPS金额。

私有接口：

- `/api/owner/session`：验证成功后仅返回 owner=true。
- `/api/owner/costs`：仅验证通过的个人所有者可读VPS续费字段。
- `/owner`：私有成本页面入口。

## 部署前配置

1. 在 Cloudflare Access 创建 Self-hosted 应用，保护探针域名的 `/owner` 与 `/api/owner/*`，使用同一个应用的 AUD。策略只允许你自己的邮箱登录，不能把全站设为私有，否则普通用户无法看探针。
2. 配置 Worker 变量 `ACCESS_TEAM_DOMAIN=https://你的团队.cloudflareaccess.com`、`ACCESS_AUD=此Access应用的AUD`、`OWNER_EMAIL=你的唯一邮箱`。
3. 保持原有 `MMWX_ORIGIN` 与 `PROBE_TOKEN`（Secret）配置。
4. `/owner` 会通过Access登录；API校验JWT签名、issuer、audience、exp/iat/sub/email、type=app和唯一OWNER_EMAIL。普通用户、伪造header、过期token、错误应用均被拒绝。未配置时默认403。

没有把主控Passkey直接当作探针身份；上游已有Passkey功能是跳转主控。Cloudflare Access通过已验证JWT提供探针的所有者身份。UI隐藏不是鉴权。

私有响应Cache-Control为private,no-store；不将真实成本写入静态文件或浏览器localStorage。退出链接使用Cloudflare Access logout。演示入口的金额均为代码内虚构数值，不表示已登录或授权。

## 本地只读预览

`.env.local` 可以配置 `PROBE_PREVIEW_ORIGIN=https://现有公开探针域名`；仅Vite开发服务使用，读取公开接口并先经过同一字段过滤，再交给浏览器。此模式禁用私有成本并采用HTTP轮询，避免把线上公开返回的成本继续泄露给本地浏览器。依赖本机curl处理系统网络代理。未配置该变量时仍按原README通过本地Wrangler连接主控。

IP质量暂未接第三方API或实际出口IP，界面明确为未接入，只提供来源网站入口，不展示虚构评分或推断的具体IP。实际付款历史也没有数据源。

## 验证

`npm test` 包含字段过滤、三网匹配、JWT拒绝路径，以及Miniflare运行时的HTTP/WS一致过滤、普通用户拒绝、合法所有者读取、缓存隔离测试。生产Access策略和主控连接仍需部署后验证。

## 原有视图的成本恢复

原有视图也通过 useProbe 在内存中合并 `/api/owner/costs` 的已认证成本字段，以唯一节点名称关联；公开 HTTP/WS 仍不含金额。每分钟及窗口重新聚焦时重新验证，失败清除私有字段，无数据汇总不再显示为真实零金额。完成 `/owner` 的 Access 登录后回到首页即可查看原有成本分析和续费时间轴。

2026-10-25 线上 `/api/owner/session` 实测 `configured:false`，需要先按上文配置 Access 应用和三个 Worker 变量；仅重新部署代码无法完成所有者身份配置。

## 新旧主题切换后成本可见性（2026-10-28）

`useProbe` 默认在所有页面尝试读取经过所有者鉴权的 `/api/owner/costs`，不再以当前路径是否等于 `/owner` 决定是否读取。因此已认证所有者在首页、`?view=classic` 和自定义主题之间切换后，原有节点成本与续费展示可以继续取得私有字段。仍按唯一节点名称合并、只存内存；接口拒绝或会话失效时清空私有字段，公开 HTTP/WS 过滤和服务端 Access 校验不变。首次认证入口仍为 `/owner`，未配置 Access 时不会返回成本。

## 登录页误判与入口诊断（2026-10-28）

Access 未登录可能把接口重定向到 HTTP 200 HTML 登录页。不能用 `response.ok` 判断 owner。前端现在验证 JSON 内容类型、禁止自动跟随认证跳转，session 必须明确返回 `owner:true` 才认定登录；成本页区分未登录、配置未完成和只读预览。成本标签始终可进入并显示原因，不再因未登录直接消失。

当前本地 `?demo=1` 是演示页面；只读预览服务明确禁用私有成本，不能用这里核实实际金额。真实成本与到期应在部署域名的 `/owner` 完成 Access 登录后查看。仅切主题或登录主控不会建立探针的 owner 会话。线上匿名核查已见 owner 接口进入 HTML 登录页，未据此声称用户本人会话已成功或服务端配置已完成。
