# push-cli

`push-cli` 是供 Agent 低成本接入 Lark 群聊机器人的单向消息推送参考实现。它只通过自定义机器人 webhook 发送消息，不接收事件、不提供回调、消息读取或其他 Lark API 能力。

仓库根目录是 Go CLI 参考实现；`skills/lark-push/` 是可单独安装的 Agent Skill，包含操作说明和示例。CLI 仅调用群聊自定义机器人 webhook 推送消息，不提供其他 Lark API。

可用 GitHub CLI 安装：

```sh
gh skill install ybbapp/push-cli lark-push
```

也可以把 `skills/lark-push/` 复制到 Agent 支持的 skills 目录。Skill 提供操作说明和示例；`push-cli` 可执行文件及本地 webhook 配置需要另行准备。构建命令：

```sh
go build -o push-cli ./cmd
```

## 分发和安装

发布 tag 会构建并分发 npm 包、GitHub Release 二进制和 GHCR Docker 镜像。npm 包是推荐入口；它第一次运行时会按当前 OS/CPU 下载对应 Release 二进制并校验 SHA-256。

alpha 版本：

```sh
npx --yes @ybbapp/push-cli@alpha --version
```

直接下载 Release 二进制：

```sh
gh release download alpha-0.0.1 \
  --repo ybbapp/push-cli \
  --pattern 'push-cli-alpha-0.0.1-*-*.tar.gz'
```

Docker 镜像支持 Linux 多架构：

```sh
docker run --rm --env LARK_WEBHOOK_URL \
  ghcr.io/ybbapp/push-cli:alpha \
  lark send --title '每日市场报告' --markdown '报告正文'
```

首次引导：npm 要求包先存在，才能配置 Trusted Publisher。仓库公开后，先推送 `alpha-0.0.1` 生成公开 Release，再从该版本源码目录手动运行一次 `npm publish --access public --tag alpha`（使用 npm 交互式登录；该版本是 `0.0.1-alpha.0`）。包存在后，在 npm 包的 **Settings → Trusted publishing** 绑定 GitHub Actions：owner `ybbapp`、repository `push-cli`、workflow filename `release.yml`，并允许 `npm publish`。之后每次推送 `alpha-*` 或 `v*` tag，workflow 使用 OIDC 发布，不需要保存 npm token。包尚未创建时，workflow 会跳过 npm job，但仍会发布 GitHub Release 和 GHCR 镜像。

首次向 GHCR 发布后，需要在 GitHub Packages 的 `push-cli` 镜像设置中将可见性改为 Public，公开后 Docker 用户才能匿名拉取。

## 配置和使用

推荐通过环境变量注入 webhook。也可以在当前工作目录放置 `.env`，或使用 `--env` 指定文件。`.env` 不应提交到仓库。

```sh
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/REPLACE_WITH_YOUR_TOKEN'
```

发送 Markdown：

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

## 版本和平台

首个 Git tag `alpha-0.0.1` 对应 npm SemVer `0.0.1-alpha.0`，发布到 npm 的 `alpha` dist-tag；GitHub Release 与 Docker tag 保留 `alpha-0.0.1`，并更新 Docker `alpha` tag。

原生二进制支持 macOS amd64/arm64、Linux amd64/arm64/riscv64、Windows amd64/arm64。Docker 镜像支持 Linux amd64/arm64/riscv64。
