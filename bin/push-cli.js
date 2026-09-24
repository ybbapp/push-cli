#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { ensureBinary } = require("../scripts/install");

async function main() {
  try {
    const executable = await ensureBinary();
    const result = spawnSync(executable, process.argv.slice(2), { stdio: "inherit" });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  } catch (error) {
    console.error(`push-cli: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
