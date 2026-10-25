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
