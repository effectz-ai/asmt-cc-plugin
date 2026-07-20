#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const packageSpec = "@fission-ai/openspec@1.6.0";

function run(args) {
  const result = spawnSync("npx", ["--yes", packageSpec, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`OpenSpec ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`);
  }

  return `${result.stdout}${result.stderr}`;
}

const versionOutput = run(["--version"]);
if (!/\b1\.6\.0\b/.test(versionOutput)) {
  throw new Error(`Expected OpenSpec 1.6.0, received: ${versionOutput.trim()}`);
}

const initHelp = run(["init", "--help"]);
for (const capability of ["--profile", "--tools", "core", "claude", "codex"]) {
  if (!initHelp.includes(capability)) {
    throw new Error(`OpenSpec init help does not advertise required capability: ${capability}`);
  }
}

console.log("OpenSpec capability validation passed.");
console.log("- @fission-ai/openspec@1.6.0 is reachable.");
console.log("- init supports the core profile and both claude and codex tool IDs.");
