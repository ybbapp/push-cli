# push-cli

向 Lark 群聊机器人单向发送 Markdown 消息的 CLI。只使用自定义机器人 webhook，不读取消息或提供其他 Lark API。

## 安装

需要 Node.js 18 或更新版本。

```sh
npm install --global @ybbapp/push-cli@alpha
```

也可以一次性运行：

```sh
npx --yes @ybbapp/push-cli@alpha lark send --title '每日市场报告' --markdown '报告正文'
```

## 配置和使用

设置群聊机器人的 webhook：

```sh
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/你的机器人密钥'
```

发送 Markdown：

```sh
push-cli lark send --title '每日市场报告' --markdown '报告正文'
push-cli lark send --title '每日市场报告' --file report.md
```

也可以通过 `--chart-file` 附加原生图表；仓库内的 [Lark skill](skills/lark-push/SKILL.md) 提供 Agent 调用说明和示例。安装 skill：

```sh
gh skill install ybbapp/push-cli lark-push
```
