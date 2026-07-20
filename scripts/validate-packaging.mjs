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

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);

  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return "";
  }
}

function occurrenceCount(value, fragment) {
  return value.split(fragment).length - 1;
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
const sharedInitializerText = readText("asmt/skills/workflow-init/SKILL.md");
const workflowMetadataText = readText(
  "asmt/skills/workflow-init/agents/openai.yaml",
);
const lanesText = readText("asmt/skills/lanes/SKILL.md");
const lanesMetadataText = readText("asmt/skills/lanes/agents/openai.yaml");
const claudeGuidanceTemplate = readText("asmt/templates/claude-md-section.md");
const codexGuidanceTemplate = readText("asmt/templates/agents-md-section.md");
const codexPermissionsTemplate = readText(
  "asmt/templates/codex-permissions.toml",
);
const processTemplate = readText(
  "asmt/templates/ai-dev-workflow-standard.md",
);
const verifyTemplate = readText("asmt/templates/verify.yml.tmpl");
const readmeText = readText("README.md");

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
  !fs.existsSync(legacyInitializer) && fs.existsSync(sharedInitializer),
  "workflow-init must exist only as the shared skill",
);
check(
  fs.existsSync(path.join(repoRoot, "asmt/skills/lanes/SKILL.md")),
  "The shared lanes skill must remain available",
);

// Claude and Codex use separate explicit-invocation controls on the same skill.
check(
  /^name:\s*workflow-init$/m.test(sharedInitializerText) &&
    /^disable-model-invocation:\s*true$/m.test(sharedInitializerText),
  "The shared workflow initializer must retain its name and Claude explicit-only policy",
);
check(
  /allow_implicit_invocation:\s*false/.test(workflowMetadataText) &&
    /\$asmt:workflow-init/.test(workflowMetadataText),
  "Codex workflow-init metadata must require explicit $asmt:workflow-init invocation",
);
check(
  /allow_implicit_invocation:\s*true/.test(lanesMetadataText) &&
    /\$asmt:lanes/.test(lanesMetadataText),
  "Codex lanes metadata must remain eligible for implicit invocation",
);
check(
  /\/asmt:lanes/.test(lanesText) && /\$asmt:lanes/.test(lanesText),
  "The lanes skill must document both host invocations",
);

for (const input of [
  "targets",
  "gate_command",
  "package_manager",
  "integration_branch",
  "release_branch",
  "card_tool",
  "node_source",
]) {
  check(
    sharedInitializerText.includes(input),
    `The shared initializer must normalize ${input}`,
  );
}

for (const adapterValue of [
  "Active-host evidence",
  "OpenSpec tool ID",
  "OpenSpec invocations",
  "Review command",
  "Durable guidance",
  "Security policy",
  "Reporting label",
]) {
  check(
    sharedInitializerText.includes(adapterValue),
    `The host adapter table must define ${adapterValue}`,
  );
}

check(
  sharedInitializerText.includes("../../templates/") &&
    sharedInitializerText.includes("${CLAUDE_PLUGIN_ROOT}/templates/") &&
    !/\$\{(?:CODEX|OPENAI)[^}]*\}\/templates\//.test(sharedInitializerText),
  "Templates must use the shared relative path with only the Claude plugin-root fallback",
);
check(
  sharedInitializerText.includes("package.json#packageManager") &&
    sharedInitializerText.indexOf("package.json#packageManager") <
      sharedInitializerText.indexOf("pnpm-lock.yaml"),
  "Package-manager detection must inspect package.json#packageManager before lockfiles",
);
check(
  sharedInitializerText.includes("Always show and confirm the final gate command") &&
    sharedInitializerText.includes("never fabricate a missing script"),
  "The initializer must always confirm the gate and reject invented scripts",
);
check(
  sharedInitializerText.includes(
    "Generated by the ASMT plugin (/asmt:workflow-init)",
  ),
  "The shared initializer must recognize legacy Claude-generated verification workflows",
);
check(
  sharedInitializerText.includes("<runner> init --help") &&
    sharedInitializerText.includes(
      "<runner> init --profile core --tools <comma-separated-missing-targets>",
    ),
  "OpenSpec preflight and additive core initialization must remain explicit",
);
check(
  sharedInitializerText.includes("Never run `openspec update` implicitly") &&
    !/npm (?:i|install)(?: --global| -g)? openspec(?:\s|`)/.test(
      sharedInitializerText,
    ),
  "The initializer must not update OpenSpec implicitly or install the bare package",
);

for (const artifact of [
  "openspec-explore",
  "openspec-propose",
  "openspec-apply-change",
  "openspec-sync-specs",
  "openspec-archive-change",
  "openspec-update-change",
]) {
  check(
    sharedInitializerText.includes(artifact),
    `OpenSpec completeness must include ${artifact}`,
  );
}

for (const template of [claudeGuidanceTemplate, codexGuidanceTemplate]) {
  check(
    occurrenceCount(template, "<!-- asmt:start -->") === 1 &&
      occurrenceCount(template, "<!-- asmt:end -->") === 1,
    "Every durable-guidance template must contain exactly one ASMT marker pair",
  );
}

check(
  /extends\s*=\s*":workspace"/.test(codexPermissionsTemplate) &&
    /"\*\*\/\.env"\s*=\s*"deny"/.test(codexPermissionsTemplate) &&
    /"\*\*\/\*\.key"\s*=\s*"deny"/.test(codexPermissionsTemplate) &&
    /"\*\*\/secrets\/\*\*"\s*=\s*"deny"/.test(
      codexPermissionsTemplate,
    ) &&
    /"\*\*\/\*\.local"\s*=\s*"deny"/.test(codexPermissionsTemplate),
  "The Codex asmt-workspace template must extend :workspace and deny sensitive files",
);
check(
  /^default_permissions\s*=\s*"asmt-workspace"$/m.test(codexPermissionsTemplate),
  "The Codex permission template must select its matching custom profile atomically",
);
check(
  sharedInitializerText.includes("Never overwrite or rewrite an existing top-level") &&
    sharedInitializerText.includes("A declined, blocked, or failed") &&
    sharedInitializerText.includes("`enforced` only after"),
  "Codex policy activation and reporting must remain confirmation- and load-aware",
);

for (const invocation of [
  "/asmt:workflow-init",
  "$asmt:workflow-init",
  "/opsx:propose",
  "$openspec-propose",
  "/code-review",
  "/review",
]) {
  check(
    processTemplate.includes(invocation),
    `The platform-neutral process template must map ${invocation}`,
  );
}
check(
  processTemplate.includes("OpenSpec + the active coding") &&
    processTemplate.includes("{{RELEASE_BRANCH}}") &&
    !processTemplate.includes("One tool — **Claude Code**"),
  "The shared process document must remain platform-neutral",
);
check(
  verifyTemplate.includes("Generated by the ASMT workflow initializer") &&
    !verifyTemplate.includes("/asmt:workflow-init"),
  "The verification workflow ownership marker must be platform-neutral",
);
check(
  !readmeText.includes("remains Claude-only") &&
    readmeText.includes("$asmt:workflow-init") &&
    readmeText.includes("/asmt:workflow-init"),
  "README must expose the shared initializer on both hosts",
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

check(
  codexManifest.interface?.defaultPrompt?.some((prompt) =>
    prompt.includes("$asmt:workflow-init"),
  ),
  "Codex default prompts must expose the shared initializer",
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
console.log("- The shared initializer and lanes skill expose both host adapters.");
console.log("- OpenSpec, guidance markers, and security templates satisfy the Step 2 contract.");
