# 独立自定义探针主题

## 配置

主控「系统设置 → 探针 → 探针主题」选择「自定义主题名称」，填写 `xin-observatory`，保存并刷新外置探针页面。外置探针必须部署包含此主题的版本；填写名称不会自动下载第三方主题。

入口读取官方快照的 `appearance.theme`，只有上述精确名称加载自定义组件。其他主题继续使用原有 App；原有 App.tsx 和 PremiumProbePage.tsx 恢复仓库基线内容，不向原主题插入扩展。

自定义组件组合现有 PremiumProbePage 与独立 IP 报告区；保留金色页面，在组件外追加报告，不修改内置组件实现。私有成本读取仅由自定义主题显式启用，仍需服务端 Access 配置，不能通过 CSS 获得权限。

## 官方规则与本项目扩展

- 官方探针字段：https://miaomiaowux.com/docs/probe-api/ ，提供 appearance.theme / color_mode / revision。
- 官方自定义 CSS：https://miaomiaowux.com/docs/custom-css/ ，只调整样式，不能执行查询脚本；主控 CSS 注入不等于给外置探针安装功能。
- 官方外置探针部署：https://miaomiaowux.com/docs/install-external-probe/ 。主控密钥由 Worker 保存。
- `xin-observatory` 是本仓库实现的自定义主题名称，不是官方内置主题。

扩展代码保存在 CustomProbeTheme、EmbeddedIPQuality 等独立模块；原有布局、内置主题组件不直接修改。公开金额过滤继续保留，以满足之前的隐私要求。

## 所有者入口与主题

`/owner` 只作为 Access 登录和私有成本入口，同样遵循后台 `appearance.theme`，不再强制打开 Observatory 页面。原主题在此路径登录后可在原布局读取私有成本，首页仍保持公开过滤；自定义主题继续通过已认证私有接口获取成本。2026-10-25 核查线上返回 premium/light，show_globe=true；未选择 xin-observatory 时不会向原页面插入 IP 报告。现有地球为拖动旋转，没有自动自转。

## 独立科技感布局（2026-10-25，替代前述金色组合）

用户明确选择全新的科技感布局。CustomProbeTheme 现独立使用 Dashboard，不再组合 PremiumProbePage 或添加 theme-premium 类。采用深蓝网格、青蓝指标、三网延迟/丢包节点卡片、系统资源与历史、流量及 IP 报告。总览直接展示 IP 区，另有专用 IP 页；原版 App/Premium 文件继续与基线一致。

地球新增可选 autoRotate，默认 false 保持原主题行为；科技主题显式开启，可暂停/恢复，拖动期间暂停，隐藏标签页和系统减少动态效果时不更新旋转。标记仍为地区聚合而非精确位置。未展示转发链。

浏览器使用真实 11 节点核验科技主题与 IP 页、地球暂停/恢复按钮。IP 收录范围仍只有已授权公布的 24.249.30.27；IPLense 为已读快照，IPPure/Net.Coffee 未接入，不代表全部节点已具备评分。源站公开快照没有 IP 映射，不能按名字猜测绑定。
