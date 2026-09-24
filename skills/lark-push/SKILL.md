---
name: lark-push
description: Send one-way messages to a Lark group bot using push-cli. Use when an agent needs to publish a report or update to a Lark group.
---

# Lark group push

Use `push-cli` to send Markdown reports to a Lark group bot. If it is not installed, run the alpha npm package with `npx --yes @ybbapp/push-cli@alpha`. The npm launcher downloads the matching binary from GitHub Releases on first use. This skill only publishes messages through a custom-bot webhook; it cannot read group messages, receive events, handle callbacks, or call other Lark APIs.

## Send a message

```sh
push-cli lark send --title '标题' --markdown 'Markdown 正文'
```

For a report file or standard input:

```sh
push-cli lark send --title '每日市场报告' --file report.md
cat report.md | push-cli lark send --title '每日市场报告'
```

Optional flags include `--icon` (defaults to 📊) and `--chart-file` for a VChart chart specification. Example chart specifications are in `examples/`. The CLI reads the file path relative to the current working directory. From the repository root, send a card with a line chart like this:

```sh
push-cli lark send \
  --title 'NVDA 行情' \
  --markdown 'NVDA 收盘价走势' \
  --chart-file skills/lark-push/examples/nvda-line-chart.json
```

For the price and volume example, use `skills/lark-push/examples/nvda-price-volume-chart.json`. If this skill was installed separately, pass the path to its `examples/` file (relative to your current directory or as an absolute path).

Provide `LARK_WEBHOOK_URL` as an environment variable, or configure it in a local `.env` file. Treat this URL as a secret. Do not print it or include it in messages.
