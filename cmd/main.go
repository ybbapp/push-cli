package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/ybbapp/push-cli/cmd/lark"
)

var version = "dev"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "push-cli:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 1 && (args[0] == "--version" || args[0] == "version") {
		fmt.Println("push-cli", version)
		return nil
	}
	if len(args) == 0 || args[0] != "lark" {
		return errors.New("用法: push-cli lark send [选项]；使用 --version 查看版本")
	}
	return lark.Run(args[1:])
}
