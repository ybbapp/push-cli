# push-cli

`push-cli` 是供 Agent 低成本接入 Lark 群聊机器人的单向消息推送参考实现。它只通过自定义机器人 webhook 发送消息，不接收事件、不提供回调、消息读取或其他 Lark API 能力。

仓库根目录是可独立构建的 CLI 参考实现；`skills/lark/` 是可单独安装的 Lark 子 skill，包含操作说明和示例数据。Skill 通过调用 `push-cli lark send` 发送内容。

将 `skills/lark/` 复制到 Agent 支持的 skills 目录即可安装。构建命令：

```sh
go build -o push-cli ./cmd
```

复制 `.env.example` 为 `.env` 并填写 `LARK_WEBHOOK_URL`，随后发送 Markdown：

```sh
push-cli lark send --title '每日市场报告' --file report.md
cat report.md | push-cli lark send --title '每日市场报告'
```
