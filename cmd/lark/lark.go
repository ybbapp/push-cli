// Package lark sends one-way messages to Lark group bots.
package lark

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type cardMessage struct {
	MsgType string `json:"msg_type"`
	Card    card   `json:"card"`
}

type card struct {
	Schema string     `json:"schema"`
	Config cardConfig `json:"config,omitempty"`
	Header cardHeader `json:"header"`
	Body   cardBodyV2 `json:"body"`
}

type cardConfig struct {
	WidthMode string `json:"width_mode,omitempty"`
}

type cardHeader struct {
	Title    cardText `json:"title"`
	Template string   `json:"template"`
}

type cardText struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type cardBodyV2 struct {
	Direction string            `json:"direction,omitempty"`
	Elements  []json.RawMessage `json:"elements"`
}

type markdownElement struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type chartElement struct {
	Tag         string          `json:"tag"`
	ChartSpec   json.RawMessage `json:"chart_spec"`
	AspectRatio string          `json:"aspect_ratio,omitempty"`
	ColorTheme  string          `json:"color_theme,omitempty"`
}

type webhookResponse struct {
	Code          *int   `json:"code"`
	Msg           string `json:"msg"`
	StatusCode    *int   `json:"StatusCode"`
	StatusMessage string `json:"StatusMessage"`
}

func Run(args []string) error {
	if len(args) == 0 || args[0] != "send" {
		return errors.New("用法: push-cli lark send [选项]")
	}
	flags := flag.NewFlagSet("push-cli lark send", flag.ContinueOnError)
	args = args[1:]
	flags.SetOutput(os.Stderr)
	title := flags.String("title", "", "报告标题（必填）")
	markdown := flags.String("markdown", "", "Markdown 正文；未提供时从 --file 或标准输入读取")
	file := flags.String("file", "", "从文件读取 Markdown 正文")
	chartFile := flags.String("chart-file", "", "读取 VChart 图表规格 JSON，作为原生图表组件加入卡片")
	icon := flags.String("icon", "📊", "标题前显示的 emoji 图标")
	envPath := flags.String("env", "", "环境文件路径（默认读取可执行文件旁的 .env）")
	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("不接受位置参数；运行 --help 查看用法")
	}
	if strings.TrimSpace(*title) == "" {
		return errors.New("必须提供 --title")
	}

	body := *markdown
	if *file != "" {
		if *markdown != "" {
			return errors.New("--markdown 和 --file 不能同时使用")
		}
		data, err := os.ReadFile(*file)
		if err != nil {
			return fmt.Errorf("读取正文文件失败: %w", err)
		}
		body = string(data)
	} else if body == "" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return fmt.Errorf("读取标准输入失败: %w", err)
		}
		body = string(data)
	}
	if strings.TrimSpace(body) == "" {
		return errors.New("Markdown 正文不能为空")
	}

	elements := make([]json.RawMessage, 0, 2)
	markdownJSON, err := json.Marshal(markdownElement{Tag: "markdown", Content: body})
	if err != nil {
		return fmt.Errorf("编码 Markdown 组件失败: %w", err)
	}
	elements = append(elements, markdownJSON)
	if *chartFile != "" {
		chartSpec, err := os.ReadFile(*chartFile)
		if err != nil {
			return fmt.Errorf("读取图表规格失败: %w", err)
		}
		var chartObject map[string]json.RawMessage
		if err := json.Unmarshal(chartSpec, &chartObject); err != nil || chartObject == nil {
			return errors.New("图表规格必须是有效的 JSON 对象")
		}
		chartJSON, err := json.Marshal(chartElement{
			Tag:         "chart",
			ChartSpec:   json.RawMessage(chartSpec),
			AspectRatio: "16:9",
			ColorTheme:  "brand",
		})
		if err != nil {
			return fmt.Errorf("编码图表组件失败: %w", err)
		}
		elements = append(elements, chartJSON)
	}

	path := *envPath
	if path == "" {
		executable, err := os.Executable()
		if err != nil {
			return fmt.Errorf("定位可执行文件失败: %w", err)
		}
		path = filepath.Join(filepath.Dir(executable), ".env")
	}
	values, err := readEnv(path)
	if err != nil {
		return err
	}
	webhook := strings.TrimSpace(values["LARK_WEBHOOK_URL"])
	u, err := url.Parse(webhook)
	if err != nil || u.Scheme != "https" || (u.Host != "open.feishu.cn" && u.Host != "open.larksuite.com") || !strings.HasPrefix(u.Path, "/open-apis/bot/v2/hook/") {
		return errors.New(".env 中 LARK_WEBHOOK_URL 缺失或不是Lark/飞书自定义机器人 webhook")
	}

	iconText := strings.TrimSpace(*icon)
	if iconText != "" {
		iconText += " "
	}
	msg := cardMessage{
		MsgType: "interactive",
		Card: card{
			Schema: "2.0",
			Config: cardConfig{WidthMode: "fill"},
			Header: cardHeader{
				Title:    cardText{Tag: "plain_text", Content: iconText + strings.TrimSpace(*title)},
				Template: "blue",
			},
			Body: cardBodyV2{Direction: "vertical", Elements: elements},
		},
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("编码飞书卡片失败: %w", err)
	}

	request, err := http.NewRequest(http.MethodPost, webhook, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("构造请求失败: %w", err)
	}
	request.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("发送飞书消息失败: %w", err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("读取飞书响应失败: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("飞书返回 HTTP %s", response.Status)
	}
	var result webhookResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return errors.New("飞书返回了无法识别的响应")
	}
	if result.Code != nil && *result.Code != 0 {
		return fmt.Errorf("飞书拒绝消息（code=%d, msg=%s）", *result.Code, result.Msg)
	}
	if result.StatusCode != nil && *result.StatusCode != 0 {
		return fmt.Errorf("飞书拒绝消息（StatusCode=%d, msg=%s）", *result.StatusCode, result.StatusMessage)
	}
	fmt.Fprintln(os.Stdout, "飞书消息已发送")
	return nil
}

func readEnv(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取环境文件 %s 失败: %w", path, err)
	}
	values := make(map[string]string)
	for lineNo, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(strings.TrimSuffix(line, "\r"))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return nil, fmt.Errorf("环境文件第 %d 行格式无效", lineNo+1)
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		if key == "" {
			return nil, fmt.Errorf("环境文件第 %d 行缺少变量名", lineNo+1)
		}
		values[key] = value
	}
	return values, nil
}
