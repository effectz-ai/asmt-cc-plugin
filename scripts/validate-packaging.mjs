#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);

  try {
    const raw = fs.readFileSync(absolutePath, "utf8");
    return { path: absolutePath, raw, value: JSON.parse(raw) };
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return { path: absolutePath, raw: "", value: {} };
  }
}

function firstPlugin(marketplace, relativePath) {
  check(
    Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1,
    `${relativePath} must expose exactly one plugin`,
  );
  return marketplace.plugins?.[0] ?? {};
}

const claudeMarketplaceFile = readJson(".claude-plugin/marketplace.json");
const claudeManifestFile = readJson("asmt/.claude-plugin/plugin.json");
const codexMarketplaceFile = readJson(".agents/plugins/marketplace.json");
const codexManifestFile = readJson("asmt/.codex-plugin/plugin.json");

const claudeMarketplace = claudeMarketplaceFile.value;
const claudeManifest = claudeManifestFile.value;
const codexMarketplace = codexMarketplaceFile.value;
const codexManifest = codexManifestFile.value;
const claudePluginEntry = firstPlugin(
  claudeMarketplace,
  ".claude-plugin/marketplace.json",
);
const codexPluginEntry = firstPlugin(
  codexMarketplace,
  ".agents/plugins/marketplace.json",
);

check(
  claudeMarketplace.name === "asmt-cc-plugin",
  "Claude marketplace name must remain asmt-cc-plugin",
);
check(
  claudePluginEntry.name === "asmt" && claudePluginEntry.source === "./asmt",
  "Claude marketplace must continue exposing asmt from ./asmt",
);
check(claudeManifest.name === "asmt", "Claude plugin name must remain asmt");
check(
  !Object.hasOwn(claudeManifest, "version"),
  "Claude plugin manifest must remain intentionally unversioned",
);

const legacyInitializer = path.join(repoRoot, "asmt/commands/workflow-init.md");
const sharedInitializer = path.join(repoRoot, "asmt/skills/workflow-init/SKILL.md");
const initializerCount = [legacyInitializer, sharedInitializer].filter((file) =>
  fs.existsSync(file),
).length;

check(
  initializerCount === 1,
  "Exactly one workflow-init command or skill must exist",
);
check(
  fs.existsSync(path.join(repoRoot, "asmt/skills/lanes/SKILL.md")),
  "The shared lanes skill must remain available",
);

check(
  codexMarketplace.name === claudeMarketplace.name,
  "Claude and Codex marketplaces must use the same identity",
);
check(
  codexMarketplace.interface?.displayName === "ASMT",
  "Codex marketplace display name must be ASMT",
);
check(
  codexPluginEntry.name === claudePluginEntry.name,
  "Claude and Codex marketplaces must expose the same plugin name",
);
check(
  codexPluginEntry.source?.source === "local" &&
    codexPluginEntry.source?.path === "./asmt",
  "Codex marketplace must expose the local plugin at ./asmt",
);
check(
  codexPluginEntry.policy?.installation === "AVAILABLE" &&
    codexPluginEntry.policy?.authentication === "ON_INSTALL",
  "Codex marketplace policy must be AVAILABLE with ON_INSTALL authentication",
);
check(
  codexPluginEntry.category === "Productivity",
  "Codex marketplace category must be Productivity",
);

const strictSemver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
check(codexManifest.name === "asmt", "Codex plugin name must be asmt");
check(
  strictSemver.test(codexManifest.version ?? ""),
  "Codex plugin version must use strict semantic versioning",
);
check(
  codexManifest.author?.name === "effectz-ai",
  "Codex plugin author must be effectz-ai",
);
check(
  codexManifest.skills === "./skills/",
  "Codex plugin must load the shared ./skills/ directory",
);
check(
  !["hooks", "mcpServers", "apps"].some((field) =>
    Object.hasOwn(codexManifest, field),
  ),
  "Codex manifest must not declare unavailable hooks, MCP servers, or apps",
);

for (const field of [
  "displayName",
  "shortDescription",
  "longDescription",
  "developerName",
  "category",
]) {
  check(
    typeof codexManifest.interface?.[field] === "string" &&
      codexManifest.interface[field].length > 0,
    `Codex interface.${field} must be a non-empty string`,
  );
}

check(
  codexManifest.interface?.capabilities?.includes("Interactive") &&
    codexManifest.interface?.capabilities?.includes("Write"),
  "Codex plugin capabilities must include Interactive and Write",
);

const defaultPrompts = codexManifest.interface?.defaultPrompt;
check(
  Array.isArray(defaultPrompts) && defaultPrompts.length > 0 && defaultPrompts.length <= 3,
  "Codex defaultPrompt must contain one to three prompts",
);
for (const prompt of defaultPrompts ?? []) {
  check(
    typeof prompt === "string" && prompt.length <= 128,
    "Every Codex default prompt must be a string of at most 128 characters",
  );
}

const pluginRoot = path.resolve(repoRoot, codexPluginEntry.source?.path ?? "");
const pluginRelativePath = path.relative(repoRoot, pluginRoot);
check(
  pluginRelativePath !== "" &&
    !pluginRelativePath.startsWith("..") &&
    !path.isAbsolute(pluginRelativePath) &&
    fs.statSync(pluginRoot, { throwIfNoEntry: false })?.isDirectory(),
  "Codex marketplace source must resolve to a plugin directory inside the repo",
);
check(
  path.basename(pluginRoot) === codexManifest.name,
  "Codex plugin folder and manifest names must match",
);
check(
  fs.statSync(path.resolve(pluginRoot, codexManifest.skills ?? ""), {
    throwIfNoEntry: false,
  })?.isDirectory(),
  "Codex skills path must resolve inside the plugin",
);
check(
  !codexManifestFile.raw.includes("[TODO:"),
  "Codex manifest must not contain unresolved TODO placeholders",
);

if (failures.length > 0) {
  console.error("Packaging validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Packaging validation passed.");
console.log("- Claude marketplace identity and unversioned manifest are preserved.");
console.log("- Codex manifest and marketplace resolve to the shared asmt plugin.");
console.log("- Exactly one workflow initializer and the lanes skill are present.");
