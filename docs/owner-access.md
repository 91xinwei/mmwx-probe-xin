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
