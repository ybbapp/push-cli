---
name: lark-push
description: Send one-way messages to a Lark group bot using push-cli. Use when an agent needs to publish a report or update to a Lark group.
---

# Lark group push

Use the installed `push-cli` executable to send Markdown reports to a Lark group bot. This skill only publishes messages through a custom-bot webhook. It cannot read group messages, receive events, handle callbacks, or call other Lark APIs.

## Send a message

```sh
push-cli lark send --title '标题' --markdown 'Markdown 正文'
```

For a report file or standard input:

```sh
push-cli lark send --title '每日市场报告' --file report.md
cat report.md | push-cli lark send --title '每日市场报告'
```

Optional flags include `--icon` (defaults to 📊) and `--chart-file` for a VChart chart specification. Example chart specifications are in `examples/`.

Configure `LARK_WEBHOOK_URL` in the local `.env` file next to the executable. Treat this URL as a secret. Do not print it or include it in messages.
