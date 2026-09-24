# push-cli

`push-cli` 是供 Agent 低成本接入 Lark 群聊机器人的单向消息推送参考实现。它只通过自定义机器人 webhook 发送消息，不接收事件、不提供回调、消息读取或其他 Lark API 能力。

仓库根目录是可独立构建的 CLI 参考实现；`skills/lark-push/` 是符合 Agent Skills 规范、可单独安装的 Lark skill，包含操作说明和示例数据。Skill 通过调用 `push-cli lark send` 发送内容。

可用 GitHub CLI 安装：

```sh
gh skill install ybbapp/push-cli lark-push
```

也可以把 `skills/lark-push/` 复制到 Agent 支持的 skills 目录。Skill 提供操作说明和示例；`push-cli` 可执行文件及本地 webhook 配置需要另行准备。构建命令：

```sh
go build -o push-cli ./cmd
```

复制 `.env.example` 为 `.env` 并填写 `LARK_WEBHOOK_URL`，随后发送 Markdown：

```sh
push-cli lark send --title '每日市场报告' --file report.md
cat report.md | push-cli lark send --title '每日市场报告'
```

附带图表发送示例（在仓库根目录运行）：

```sh
push-cli lark send \
  --title 'NVDA 行情' \
  --markdown 'NVDA 收盘价走势' \
  --chart-file skills/lark-push/examples/nvda-line-chart.json
```
