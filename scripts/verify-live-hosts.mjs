#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const argumentsSet = new Set(process.argv.slice(2));

if (argumentsSet.has("--help")) {
  console.log(`Usage: node scripts/verify-live-hosts.mjs [checks]

Checks:
  --codex          Verify marketplace uniqueness, installation, and skill loading.
  --claude         Verify Claude installation, plugin inventory, and authentication.
  --permissions    Exercise the asmt-workspace profile in the Codex sandbox.
  --invoke-codex   Start fresh Codex sessions and explicitly invoke lanes and initializer.
  --invoke-claude  Start fresh Claude sessions and explicitly invoke lanes and initializer.
  --initializer-only
                   Skip the lanes session when rerunning an initializer smoke test.
  --allow-unsandboxed-fixture
                   Let the Codex initializer write protected .codex/ paths in its disposable fixture.
  --all            Run every check. This is the pre-release acceptance gate.

With no arguments, --codex, --claude, and --permissions are run without model invocations.`);
  process.exit(0);
}

const runAll = argumentsSet.has("--all");
const noArguments = argumentsSet.size === 0;
const checks = {
  codex:
    runAll ||
    noArguments ||
    argumentsSet.has("--codex") ||
    argumentsSet.has("--invoke-codex") ||
    argumentsSet.has("--permissions"),
  claude:
    runAll ||
    noArguments ||
    argumentsSet.has("--claude") ||
    argumentsSet.has("--invoke-claude"),
  permissions: runAll || noArguments || argumentsSet.has("--permissions"),
  invokeCodex: runAll || argumentsSet.has("--invoke-codex"),
  invokeClaude: runAll || argumentsSet.has("--invoke-claude"),
  allowUnsandboxedFixture: argumentsSet.has("--allow-unsandboxed-fixture"),
  initializerOnly: argumentsSet.has("--initializer-only"),
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 20 * 1024 * 1024,
    timeout: options.timeout ?? 60_000,
  });

  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${result.status}${detail ? `:\n${detail}` : ""}`,
    );
  }
  return result;
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}`);
  }
}

function commandAvailable(command) {
  return spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
  }).status === 0;
}

function claudeCommand() {
  if (commandAvailable("claude")) return { command: "claude", prefix: [] };
  return {
    command: "npx",
    prefix: ["--yes", "@anthropic-ai/claude-code@2.1.215"],
  };
}

function runClaude(args, options = {}) {
  const cli = claudeCommand();
  return run(cli.command, [...cli.prefix, ...args], {
    ...options,
    timeout: options.timeout ?? 120_000,
  });
}

function semverCore(versionOutput) {
  const match = versionOutput.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Could not parse version from: ${versionOutput.trim()}`);
  return match.slice(1).map(Number);
}

function atLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

async function listCodexSkills(cwd) {
  const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdoutBuffer = "";
  let stderr = "";
  let initialized = false;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Codex app-server skills/list timed out${stderr ? `:\n${stderr}` : ""}`));
    }, 30_000);

    const finish = (callback, value) => {
      clearTimeout(timeout);
      child.kill();
      callback(value);
    };

    child.on("error", (error) => finish(reject, error));
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }

        if (message.id === 1 && message.result && !initialized) {
          initialized = true;
          child.stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", method: "initialized", params: {} })}\n`,
          );
          child.stdin.write(
            `${JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "skills/list",
              params: { cwds: [cwd], forceReload: true },
            })}\n`,
          );
        }

        if (message.id === 2) {
          if (message.error) {
            finish(reject, new Error(JSON.stringify(message.error)));
          } else {
            finish(resolve, message.result);
          }
        }
      }
    });
    child.on("exit", (code) => {
      if (!initialized && code !== null) {
        finish(
          reject,
          new Error(`Codex app-server exited with ${code}${stderr ? `:\n${stderr}` : ""}`),
        );
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          clientInfo: { name: "asmt-release-check", version: "1.0.0" },
          capabilities: { experimentalApi: true },
        },
      })}\n`,
    );
  });
}

async function verifyCodexInstallation() {
  const versionResult = run("codex", ["--version"]);
  const version = `${versionResult.stdout}${versionResult.stderr}`.trim();
  if (!atLeast(semverCore(version), [0, 138, 0])) {
    throw new Error(`Codex 0.138.0 or newer is required; found ${version}`);
  }

  const marketplaces = run("codex", ["plugin", "marketplace", "list"]).stdout;
  const marketplaceCount = marketplaces
    .split("\n")
    .filter((line) => line.trimStart().startsWith("asmt-cc-plugin ")).length;
  if (marketplaceCount !== 1) {
    throw new Error(`Expected one ASMT Codex marketplace, found ${marketplaceCount}`);
  }

  const pluginList = parseJsonOutput(
    run("codex", ["plugin", "list", "--available", "--json"]),
    "codex plugin list",
  );
  const entries = Object.values(pluginList)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter(
      (entry) =>
        entry?.name === "asmt" && entry?.marketplaceName === "asmt-cc-plugin",
    );
  if (entries.length !== 1) {
    throw new Error(`Expected one ASMT Codex plugin entry, found ${entries.length}`);
  }
  if (!entries[0].installed || !entries[0].enabled) {
    throw new Error("The ASMT Codex plugin must be installed and enabled");
  }

  const skillResult = await listCodexSkills(repositoryRoot);
  const cwdEntry = skillResult?.data?.find((entry) => entry.cwd === repositoryRoot);
  if (!cwdEntry) throw new Error("Codex skills/list omitted the ASMT repository");
  if (cwdEntry.errors.length > 0) {
    throw new Error(`Codex skill loading errors: ${JSON.stringify(cwdEntry.errors)}`);
  }
  for (const skillName of ["asmt:workflow-init", "asmt:lanes"]) {
    const skill = cwdEntry.skills.find((entry) => entry.name === skillName);
    if (!skill?.enabled) throw new Error(`${skillName} is not enabled in Codex`);
  }

  console.log(`Codex installation validation passed (${version}).`);
  console.log("- One ASMT marketplace and one installed plugin entry are visible.");
  console.log("- asmt:workflow-init and asmt:lanes load with no skill errors.");
}

function verifyClaudeInstallation() {
  const versionResult = runClaude(["--version"]);
  const version = `${versionResult.stdout}${versionResult.stderr}`.trim();
  const pluginList = parseJsonOutput(
    runClaude(["plugin", "list", "--json"]),
    "claude plugin list",
  );
  const serialized = JSON.stringify(pluginList);
  if (!serialized.includes("asmt@asmt-cc-plugin")) {
    throw new Error("ASMT is not installed from the Claude marketplace");
  }

  const details = runClaude(["plugin", "details", "asmt@asmt-cc-plugin"]).stdout;
  for (const expected of ["workflow-init", "lanes"]) {
    if (!details.includes(expected)) {
      throw new Error(`Claude plugin inventory omitted ${expected}`);
    }
  }

  const auth = parseJsonOutput(
    runClaude(["auth", "status"], { allowFailure: true }),
    "claude auth status",
  );
  console.log(`Claude installation validation passed (${version}).`);
  console.log("- ASMT is installed and both shared skills appear in its inventory.");
  console.log(`- Authenticated live sessions: ${auth.loggedIn ? "available" : "unavailable"}.`);
  return auth.loggedIn;
}

function createPermissionFixture() {
  const root = repositoryRoot;
  const configDirectory = path.join(root, ".codex");
  const configPath = path.join(configDirectory, "config.toml");
  const hadConfig = fs.existsSync(configPath);
  const previousConfig = hadConfig ? fs.readFileSync(configPath) : undefined;
  const templateConfig = fs.readFileSync(
    path.join(repositoryRoot, "asmt/templates/codex-permissions.toml"),
  );
  if (hadConfig && !previousConfig.equals(templateConfig)) {
    throw new Error("refusing to replace an existing project .codex/config.toml");
  }
  const evidenceRoot = path.join(root, ".release-evidence");
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const fixtureRoot = fs.mkdtempSync(path.join(evidenceRoot, "permissions-"));
  fs.mkdirSync(configDirectory, { recursive: true });
  if (!hadConfig) fs.writeFileSync(configPath, templateConfig);

  const sensitiveFiles = [
    ".env",
    "nested/.env.production",
    "keys/service.key",
    "certificates/service.pem",
    "certificates/service.crt",
    "secrets/token.txt",
    "config/app.local",
  ].map((relativePath) =>
    path.relative(root, path.join(fixtureRoot, relativePath)).split(path.sep).join("/"),
  );
  for (const relativePath of sensitiveFiles) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `ASMT_DENY_SENTINEL:${relativePath}\n`);
  }
  return {
    root,
    evidenceRoot,
    fixtureRoot,
    configDirectory,
    configPath,
    hadConfig,
    previousConfig,
    sensitiveFiles,
    ordinaryFile: path
      .relative(root, path.join(fixtureRoot, "ordinary.txt"))
      .split(path.sep)
      .join("/"),
  };
}

function verifyCodexPermissions() {
  const fixture = createPermissionFixture();
  try {
    const doctor = run(
      "codex",
      ["--strict-config", "-C", fixture.root, "doctor", "--json"],
      { allowFailure: true },
    );
    const doctorReport = parseJsonOutput(doctor, "codex doctor");
    const doctorChecks = Array.isArray(doctorReport.checks)
      ? doctorReport.checks
      : Object.values(doctorReport.checks ?? {});
    const configLoad = doctorChecks.find((check) => check.id === "config.load");
    if (!configLoad) throw new Error("Codex doctor omitted the config.load check");
    if (!["ok", "pass", "passed"].includes(configLoad.status)) {
      throw new Error(`Codex strict config load failed: ${JSON.stringify(configLoad)}`);
    }

    run(
      "codex",
      [
        "sandbox",
        "-P",
        "asmt-workspace",
        "-C",
        fixture.root,
        "--",
        "/usr/bin/touch",
        fixture.ordinaryFile,
      ],
      { cwd: fixture.root },
    );
    if (!fs.existsSync(path.join(fixture.root, fixture.ordinaryFile))) {
      throw new Error("The ASMT profile blocked an ordinary workspace write");
    }

    for (const relativePath of fixture.sensitiveFiles) {
      const readAttempt = run(
        "codex",
        [
          "sandbox",
          "-P",
          "asmt-workspace",
          "-C",
          fixture.root,
          "--",
          "/bin/cat",
          relativePath,
        ],
        { cwd: fixture.root, allowFailure: true },
      );
      if (readAttempt.status === 0 || readAttempt.stdout.includes("ASMT_DENY_SENTINEL")) {
        throw new Error(`The ASMT profile allowed a sensitive read: ${relativePath}`);
      }

      const writeAttempt = run(
        "codex",
        [
          "sandbox",
          "-P",
          "asmt-workspace",
          "-C",
          fixture.root,
          "--",
          "/usr/bin/touch",
          relativePath,
        ],
        { cwd: fixture.root, allowFailure: true },
      );
      if (writeAttempt.status === 0) {
        throw new Error(`The ASMT profile allowed a sensitive write: ${relativePath}`);
      }
    }

    console.log("Codex permission-profile validation passed.");
    console.log("- Ordinary workspace writes succeed.");
    console.log("- Environment, key, certificate, secrets, and *.local reads/writes are denied.");
  } finally {
    fs.rmSync(fixture.fixtureRoot, { recursive: true, force: true });
    if (!fixture.hadConfig) {
      fs.unlinkSync(fixture.configPath);
      if (fs.readdirSync(fixture.configDirectory).length === 0) {
        fs.rmdirSync(fixture.configDirectory);
      }
    } else if (fixture.previousConfig) {
      fs.writeFileSync(fixture.configPath, fixture.previousConfig);
    }
    if (fs.readdirSync(fixture.evidenceRoot).length === 0) {
      fs.rmdirSync(fixture.evidenceRoot);
    }
  }
}

function createLiveProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asmt-live-init-"));
  run("git", ["init", "--quiet"], { cwd: root });
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "asmt-live-fixture",
        private: true,
        packageManager: "npm@11.12.1",
        engines: { node: ">=20.19.0" },
        scripts: { test: "node --test" },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(path.join(root, "package-lock.json"), '{"lockfileVersion":3}\n');

  const binDirectory = path.join(root, ".test-bin");
  fs.mkdirSync(binDirectory, { recursive: true });
  const fakeOpenSpec = path.join(binDirectory, "openspec");
  fs.writeFileSync(
    fakeOpenSpec,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const skills = ["openspec-explore", "openspec-propose", "openspec-apply-change", "openspec-sync-specs", "openspec-archive-change", "openspec-update-change"];
if (args[0] === "--version") { console.log("1.6.0"); process.exit(0); }
if (args[0] === "init" && args.includes("--help")) {
  console.log("init --profile core --tools claude,codex");
  process.exit(0);
}
if (args[0] !== "init") process.exit(2);
const toolsIndex = args.indexOf("--tools");
const hosts = toolsIndex >= 0 ? args[toolsIndex + 1].split(",") : [];
for (const directory of ["openspec/specs", "openspec/changes/archive"]) fs.mkdirSync(directory, { recursive: true });
if (!fs.existsSync("openspec/config.yaml") && !fs.existsSync("openspec/config.yml")) fs.writeFileSync("openspec/config.yaml", "schema: spec-driven\\ncontext: TODO\\n");
for (const host of hosts) for (const skill of skills) {
  const target = path.join("." + host, "skills", skill, "SKILL.md");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.writeFileSync(target, "---\\nname: " + skill + "\\n---\\n");
}
console.log("OpenSpec initialized: " + hosts.join(","));
`,
  );
  fs.chmodSync(fakeOpenSpec, 0o755);
  return { root, binDirectory };
}

function invokeCodexSkills() {
  const laneProject = createLiveProject();
  const initProject = createLiveProject();
  try {
    if (!checks.initializerOnly) {
      const lane = run(
        "codex",
        [
          "exec",
          "--ephemeral",
          "--sandbox",
          "workspace-write",
          "-C",
          laneProject.root,
          "Use $asmt:lanes explicitly. Select the Standard lane for a one-capability change, then end your response with ASMT_LANES_OK.",
        ],
        { cwd: laneProject.root, timeout: 300_000 },
      );
    if (!lane.stdout.includes("ASMT_LANES_OK")) {
      throw new Error("Codex did not complete the explicit $asmt:lanes smoke test");
    }
    if (!/\bStandard\b/.test(lane.stdout)) {
      throw new Error("Codex lanes smoke test did not select the Standard lane");
    }
    }

    const taskEnvironment = {
      ...process.env,
      PATH: `${initProject.binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
    };
    const initializerPrompt = [
      "Use $asmt:workflow-init explicitly to configure only Codex in this repository.",
      "Use these confirmed inputs without asking: target codex; gate command npm test; package manager npm; integration branch dev; release branch main; card tool none; Node source package.json#engines.node.",
      "The gate command is confirmed. Decline activation of the optional asmt-workspace profile. Do not create branches.",
      "Complete the initializer and end your response with ASMT_INIT_OK.",
    ].join(" ");
    const initializerAccess = checks.allowUnsandboxedFixture
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["--sandbox", "workspace-write"];
    const initializer = run(
      "codex",
      [
        "exec",
        "--ephemeral",
        ...initializerAccess,
        "-C",
        initProject.root,
        initializerPrompt,
      ],
      { cwd: initProject.root, env: taskEnvironment, timeout: 600_000 },
    );
    if (!initializer.stdout.includes("ASMT_INIT_OK")) {
      throw new Error("Codex did not complete the explicit $asmt:workflow-init smoke test");
    }

    for (const relativePath of [
      "AGENTS.md",
      ".github/workflows/verify.yml",
      "docs/process/ai-dev-workflow-standard.md",
      ".codex/skills/openspec-propose/SKILL.md",
    ]) {
      if (!fs.existsSync(path.join(initProject.root, relativePath))) {
        throw new Error(
          `Codex initializer omitted ${relativePath}. Final response:\n${initializer.stdout.slice(-6000)}`,
        );
      }
    }
    const agentsGuidance = fs.readFileSync(
      path.join(initProject.root, "AGENTS.md"),
      "utf8",
    );
    const processDocument = fs.readFileSync(
      path.join(initProject.root, "docs/process/ai-dev-workflow-standard.md"),
      "utf8",
    );
    for (const expected of [
      "$asmt:workflow-init",
      "/asmt:workflow-init",
      "$openspec-propose",
      "/opsx:propose",
    ]) {
      if (!processDocument.includes(expected)) {
        throw new Error(`Codex initializer output omitted invocation ${expected}`);
      }
    }
    if (/\{\{[A-Z0-9_]+\}\}/.test(`${agentsGuidance}\n${processDocument}`)) {
      throw new Error("Codex initializer left an unresolved output placeholder");
    }
    if (fs.existsSync(path.join(initProject.root, ".codex/config.toml"))) {
      throw new Error("Codex initializer installed a profile after activation was declined");
    }

    console.log("Codex explicit-invocation validation passed in fresh sessions.");
    console.log(
      checks.initializerOnly
        ? "- $asmt:workflow-init completed."
        : "- $asmt:lanes and $asmt:workflow-init both completed.",
    );
  } finally {
    fs.rmSync(laneProject.root, { recursive: true, force: true });
    fs.rmSync(initProject.root, { recursive: true, force: true });
  }
}

function invokeClaudeSkills(authenticated) {
  if (!authenticated) {
    throw new Error("Claude Code is not authenticated; explicit skill sessions cannot run");
  }

  const laneProject = createLiveProject();
  const initProject = createLiveProject();
  try {
    if (!checks.initializerOnly) {
      const lane = runClaude(
        [
          "--plugin-dir",
          path.join(repositoryRoot, "asmt"),
          "--print",
          "--no-session-persistence",
          "Use /asmt:lanes explicitly. Select Standard and end with ASMT_LANES_OK.",
        ],
        { cwd: laneProject.root, timeout: 300_000 },
      );
      if (!lane.stdout.includes("ASMT_LANES_OK") || !/\bStandard\b/.test(lane.stdout)) {
        throw new Error("Claude did not complete the explicit /asmt:lanes smoke test");
      }
    }
    const taskEnvironment = {
      ...process.env,
      PATH: `${initProject.binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
    };
    const initializer = runClaude(
      [
        "--plugin-dir",
        path.join(repositoryRoot, "asmt"),
        "--print",
        "--no-session-persistence",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Bash(openspec *),Bash(git *),Bash(command -v *),Bash(which *),Bash(node *),Read,Write,Edit",
        [
          "Use /asmt:workflow-init explicitly to configure only Claude Code in this repository.",
          "Use these confirmed inputs without asking: target claude; gate command npm test; package manager npm; integration branch dev; release branch main; card tool none; Node source package.json#engines.node.",
          "The gate command is confirmed. Do not create branches. Complete the initializer and end with ASMT_INIT_OK.",
        ].join(" "),
      ],
      { cwd: initProject.root, env: taskEnvironment, timeout: 300_000 },
    );
    if (!initializer.stdout.includes("ASMT_INIT_OK")) {
      throw new Error("Claude did not complete the explicit /asmt:workflow-init smoke test");
    }
    for (const relativePath of [
      "CLAUDE.md",
      ".github/workflows/verify.yml",
      "docs/process/ai-dev-workflow-standard.md",
      ".claude/skills/openspec-propose/SKILL.md",
    ]) {
      if (!fs.existsSync(path.join(initProject.root, relativePath))) {
        throw new Error(
          `Claude initializer omitted ${relativePath}. Final response:\n${initializer.stdout.slice(-6000)}`,
        );
      }
    }
    const claudeGuidance = fs.readFileSync(
      path.join(initProject.root, "CLAUDE.md"),
      "utf8",
    );
    const processDocument = fs.readFileSync(
      path.join(initProject.root, "docs/process/ai-dev-workflow-standard.md"),
      "utf8",
    );
    if (!claudeGuidance.includes("/opsx:propose")) {
      throw new Error("Claude initializer output omitted /opsx:propose");
    }
    if (/\{\{[A-Z0-9_]+\}\}/.test(`${claudeGuidance}\n${processDocument}`)) {
      throw new Error("Claude initializer left an unresolved output placeholder");
    }

    console.log("Claude explicit-invocation validation passed in fresh sessions.");
    console.log(
      checks.initializerOnly
        ? "- /asmt:workflow-init completed."
        : "- /asmt:lanes and /asmt:workflow-init both completed.",
    );
  } finally {
    fs.rmSync(laneProject.root, { recursive: true, force: true });
    fs.rmSync(initProject.root, { recursive: true, force: true });
  }
}

const failures = [];
let claudeAuthenticated = false;

async function check(label, callback) {
  try {
    await callback();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

if (checks.codex) await check("Codex installation", verifyCodexInstallation);
if (checks.claude) {
  await check("Claude installation", () => {
    claudeAuthenticated = verifyClaudeInstallation();
  });
}
if (checks.permissions) await check("Codex permissions", verifyCodexPermissions);
if (checks.invokeCodex) await check("Codex invocation", invokeCodexSkills);
if (checks.invokeClaude) {
  await check("Claude invocation", () => invokeClaudeSkills(claudeAuthenticated));
}

if (failures.length > 0) {
  console.error("Live host validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Live host validation passed.");
