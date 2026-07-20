import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml, parseDocument } from "yaml";

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, "../..");
const templatesRoot = path.join(repositoryRoot, "asmt/templates");

const workflowSkills = [
  "openspec-explore",
  "openspec-propose",
  "openspec-apply-change",
  "openspec-sync-specs",
  "openspec-archive-change",
  "openspec-update-change",
];

const claudeCommandNames = {
  "openspec-explore": "explore",
  "openspec-propose": "propose",
  "openspec-apply-change": "apply",
  "openspec-sync-specs": "sync",
  "openspec-archive-change": "archive",
  "openspec-update-change": "update",
};

const hostInvocations = {
  claude: {
    guidance: "CLAUDE.md",
    initializer: "/asmt:workflow-init",
    propose: "/opsx:propose",
    archive: "/opsx:archive",
  },
  codex: {
    guidance: "AGENTS.md",
    initializer: "$asmt:workflow-init",
    propose: "$openspec-propose",
    archive: "$openspec-archive-change",
  },
};

const template = (name) =>
  fs.readFileSync(path.join(templatesRoot, name), "utf8");

const templates = {
  agents: template("agents-md-section.md"),
  claude: template("claude-md-section.md"),
  codexPermissions: template("codex-permissions.toml"),
  process: template("ai-dev-workflow-standard.md"),
  rules: template("config.rules.yaml"),
  settings: template("settings.deny.json"),
  verify: template("verify.yml.tmpl"),
};

export function projectPath(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

export function exists(root, relativePath) {
  return fs.existsSync(projectPath(root, relativePath));
}

export function readProjectFile(root, relativePath) {
  return fs.readFileSync(projectPath(root, relativePath), "utf8");
}

export function writeProjectFile(root, relativePath, content) {
  const absolutePath = projectPath(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function writeIfChanged(root, relativePath, content, writes) {
  const absolutePath = projectPath(root, relativePath);
  const previous = fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, "utf8")
    : undefined;

  if (previous === content) return false;
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  writes.push(relativePath);
  return true;
}

function render(source, replacements, label) {
  let rendered = source;
  for (const [name, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${name}}}`, value);
  }

  const unresolved = rendered.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
  if (unresolved) {
    throw new Error(`${label} has unresolved placeholders: ${unresolved.join(", ")}`);
  }
  return rendered;
}

function listTree(root, directory = root, result = {}) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    if (entry.isDirectory()) {
      result[`${relativePath}/`] = "directory";
      listTree(root, absolutePath, result);
    } else if (entry.isFile()) {
      result[relativePath] = crypto
        .createHash("sha256")
        .update(fs.readFileSync(absolutePath))
        .digest("hex");
    }
  }
  return result;
}

export function snapshotProject(root) {
  return listTree(root);
}

function readPackageJson(root) {
  if (!exists(root, "package.json")) return {};
  return JSON.parse(readProjectFile(root, "package.json"));
}

export function detectProjectInputs(root) {
  const packageJson = readPackageJson(root);
  const declaredPackageManager =
    typeof packageJson.packageManager === "string"
      ? packageJson.packageManager.split("@")[0]
      : undefined;
  const supportedManagers = new Set(["pnpm", "npm", "yarn", "bun"]);
  const lockfileFamilies = [
    ["pnpm", ["pnpm-lock.yaml"]],
    ["yarn", ["yarn.lock"]],
    ["bun", ["bun.lock", "bun.lockb"]],
    ["npm", ["package-lock.json"]],
  ].filter(([, files]) => files.some((file) => exists(root, file)));

  let packageManager;
  let packageManagerConflict = [];
  if (declaredPackageManager && supportedManagers.has(declaredPackageManager)) {
    packageManager = declaredPackageManager;
  } else if (lockfileFamilies.length === 1) {
    packageManager = lockfileFamilies[0][0];
  } else if (lockfileFamilies.length > 1) {
    packageManagerConflict = lockfileFamilies.map(([manager]) => manager);
  }

  const scripts =
    packageJson.scripts && typeof packageJson.scripts === "object"
      ? packageJson.scripts
      : {};
  const selectedScripts = [];
  if (typeof scripts.lint === "string" && scripts.lint.trim()) {
    selectedScripts.push("lint");
  }
  const typecheckName = ["check-types", "typecheck"].find(
    (name) => typeof scripts[name] === "string" && scripts[name].trim(),
  );
  if (typecheckName) selectedScripts.push(typecheckName);
  if (typeof scripts.test === "string" && scripts.test.trim()) {
    selectedScripts.push("test");
  }

  return {
    packageManager,
    packageManagerConflict,
    selectedScripts,
    gateCommand:
      packageManager && selectedScripts.length > 0
        ? selectedScripts
            .map((name) => `${packageManager} run ${name}`)
            .join(" && ")
        : undefined,
  };
}

function ensureDirectory(root, relativePath, changes) {
  const absolutePath = projectPath(root, relativePath);
  if (fs.existsSync(absolutePath)) return;
  fs.mkdirSync(absolutePath, { recursive: true });
  changes.push(`${relativePath}/`);
}

function openSpecConfigPath(root) {
  if (exists(root, "openspec/config.yaml")) return "openspec/config.yaml";
  if (exists(root, "openspec/config.yml")) return "openspec/config.yml";
  return "openspec/config.yaml";
}

function baseOpenSpecComplete(root) {
  return (
    (exists(root, "openspec/config.yaml") || exists(root, "openspec/config.yml")) &&
    ["openspec/specs", "openspec/changes", "openspec/changes/archive"].every(
      (directory) =>
        fs.statSync(projectPath(root, directory), { throwIfNoEntry: false })?.isDirectory(),
    )
  );
}

export function integrationComplete(root, host) {
  if (!baseOpenSpecComplete(root)) return false;

  return workflowSkills.every((skill) => {
    if (host === "codex") {
      return exists(root, `.codex/skills/${skill}/SKILL.md`);
    }

    const commandName = claudeCommandNames[skill];
    return (
      exists(root, `.claude/skills/${skill}/SKILL.md`) ||
      exists(root, `.claude/commands/opsx/${commandName}.md`)
    );
  });
}

function ensureOpenSpecBase(root, changes) {
  for (const directory of [
    "openspec/specs",
    "openspec/changes",
    "openspec/changes/archive",
  ]) {
    ensureDirectory(root, directory, changes);
  }

  if (!exists(root, "openspec/config.yaml") && !exists(root, "openspec/config.yml")) {
    writeProjectFile(root, "openspec/config.yaml", "schema: spec-driven\ncontext: TODO\n");
    changes.push("openspec/config.yaml");
  }
}

export function installOpenSpecArtifacts(root, hosts, changes = []) {
  ensureOpenSpecBase(root, changes);

  for (const host of hosts) {
    for (const skill of workflowSkills) {
      const relativePath = `.${host}/skills/${skill}/SKILL.md`;
      if (exists(root, relativePath)) continue;
      writeProjectFile(
        root,
        relativePath,
        `---\nname: ${skill}\n---\n\n# ${skill}\n`,
      );
      changes.push(relativePath);
    }
  }

  return changes;
}

function validateGuidanceMarkers(root, host) {
  const relativePath = hostInvocations[host].guidance;
  if (!exists(root, relativePath)) return;

  const source = readProjectFile(root, relativePath);
  const starts = source.split("<!-- asmt:start -->").length - 1;
  const ends = source.split("<!-- asmt:end -->").length - 1;
  if (
    starts !== ends ||
    starts > 1 ||
    (starts === 1 && source.indexOf("<!-- asmt:end -->") < source.indexOf("<!-- asmt:start -->"))
  ) {
    throw new Error(`${relativePath} has malformed ASMT markers`);
  }
}

function updateGuidance(root, host, gateCommand, writes) {
  const relativePath = hostInvocations[host].guidance;
  const block = render(
    host === "claude" ? templates.claude : templates.agents,
    { GATE_CMD: gateCommand },
    relativePath,
  );
  const source = exists(root, relativePath) ? readProjectFile(root, relativePath) : "";
  const start = "<!-- asmt:start -->";
  const end = "<!-- asmt:end -->";
  const managedBlock = block.endsWith("\n") ? block.slice(0, -1) : block;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);

  let updated;
  if (startIndex >= 0 && endIndex >= 0) {
    updated = `${source.slice(0, startIndex)}${managedBlock}${source.slice(endIndex + end.length)}`;
  } else if (!source) {
    updated = block;
  } else {
    const separator = source.endsWith("\n") ? "\n" : "\n\n";
    updated = `${source}${separator}${block}`;
  }

  writeIfChanged(root, relativePath, updated, writes);
}

function packageManagerSteps(packageManager, nodeSource) {
  if (packageManager === "bun") {
    return [
      "      - uses: oven-sh/setup-bun@v2",
      "      - run: bun install --frozen-lockfile",
    ].join("\n");
  }

  const setup = [];
  if (packageManager === "pnpm") {
    setup.push("      - uses: pnpm/action-setup@v4");
  }
  setup.push("      - uses: actions/setup-node@v4", "        with:");
  if (nodeSource === ".nvmrc" || nodeSource === ".node-version") {
    setup.push(`          node-version-file: ${nodeSource}`);
  } else if (nodeSource === "package.json#engines.node") {
    setup.push("          node-version: '>=20.19.0'");
  } else {
    setup.push("          node-version: 'lts/*'");
  }
  setup.push(`          cache: ${packageManager}`);

  const install = {
    npm: "npm ci",
    pnpm: "pnpm install --frozen-lockfile",
    yarn: "yarn install --immutable",
  }[packageManager];
  setup.push(`      - run: ${install}`);
  return setup.join("\n");
}

function updateVerificationWorkflow(root, options, writes) {
  const relativePath = ".github/workflows/verify.yml";
  const rendered = render(
    templates.verify,
    {
      GATE_CMD: options.gateCommand,
      INTEGRATION_BRANCH: options.integrationBranch,
      RELEASE_BRANCH: options.releaseBranch,
      PM_SETUP_STEPS: packageManagerSteps(
        options.packageManager,
        options.nodeSource,
      ),
    },
    relativePath,
  );

  if (exists(root, relativePath)) {
    const current = readProjectFile(root, relativePath);
    const generated =
      current.includes("Generated by the ASMT workflow initializer") ||
      current.includes("Generated by the ASMT plugin (/asmt:workflow-init)");
    if (!generated && !options.replaceVerification) {
      return false;
    }
  }

  writeIfChanged(root, relativePath, rendered, writes);
  return true;
}

function updateOpenSpecConfig(root, options, writes) {
  const relativePath = openSpecConfigPath(root);
  const source = readProjectFile(root, relativePath);
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    throw new Error(`${relativePath} is malformed YAML`);
  }

  const current = document.toJS() ?? {};
  let changed = false;
  if (
    current.context === undefined ||
    current.context === null ||
    current.context === "" ||
    current.context === "TODO" ||
    String(current.context).startsWith("ASMT starter:")
  ) {
    document.set(
      "context",
      [
        "ASMT starter:",
        `- package manager: ${options.packageManager}`,
        `- node source: ${options.nodeSource}`,
        `- verification gate: ${options.gateCommand}`,
        "- domain: TODO",
        "- guardrails: TODO",
      ].join("\n"),
    );
    changed = true;
  }

  if (
    !current.rules ||
    typeof current.rules !== "object" ||
    Array.isArray(current.rules)
  ) {
    document.set("rules", parseYaml(templates.rules).rules);
    changed = true;
  }

  if (changed) writeIfChanged(root, relativePath, String(document), writes);
}

function updateProcessDocument(root, options, writes) {
  const relativePath = "docs/process/ai-dev-workflow-standard.md";
  const rendered = render(
    templates.process,
    {
      GATE_CMD: options.gateCommand,
      INTEGRATION_BRANCH: options.integrationBranch,
      RELEASE_BRANCH: options.releaseBranch,
      CARD_TOOL: options.cardTool,
    },
    relativePath,
  );

  if (
    exists(root, relativePath) &&
    !readProjectFile(root, relativePath).includes(
      "Generated by the ASMT workflow initializer",
    ) &&
    !options.replaceProcess
  ) {
    throw new Error(`${relativePath} is user-authored and replacement was not approved`);
  }

  writeIfChanged(root, relativePath, rendered, writes);
}

function updateClaudeSettings(root, writes) {
  const relativePath = ".claude/settings.json";
  const current = exists(root, relativePath)
    ? JSON.parse(readProjectFile(root, relativePath))
    : {};
  const required = JSON.parse(templates.settings).permissions.deny;
  const existing = Array.isArray(current.permissions?.deny)
    ? current.permissions.deny
    : [];
  const merged = [...existing];
  for (const entry of required) {
    if (!merged.includes(entry)) merged.push(entry);
  }

  const updated = {
    ...current,
    permissions: {
      ...(current.permissions ?? {}),
      deny: merged,
    },
  };
  writeIfChanged(root, relativePath, `${JSON.stringify(updated, null, 2)}\n`, writes);
}

function codexSecurityStatus(root, options, writes) {
  const relativePath = ".codex/config.toml";
  const current = exists(root, relativePath) ? readProjectFile(root, relativePath) : "";

  if (!options.activateCodexProfile) {
    return "activation declined; profile not installed or enforced";
  }

  let parsed = {};
  if (current) {
    try {
      parsed = parseToml(current);
    } catch {
      return "activation skipped: existing Codex config is malformed";
    }
  }

  if (
    Object.hasOwn(parsed, "sandbox_mode") ||
    Object.hasOwn(parsed, "sandbox_workspace_write")
  ) {
    return "activation skipped: legacy sandbox settings take precedence";
  }

  if (
    Object.hasOwn(parsed, "default_permissions") &&
    parsed.default_permissions !== "asmt-workspace"
  ) {
    return "activation skipped: existing default_permissions preserved";
  }

  const templateProfile = parseToml(templates.codexPermissions).permissions[
    "asmt-workspace"
  ];
  const currentProfile = parsed.permissions?.["asmt-workspace"];
  if (
    currentProfile &&
    JSON.stringify(currentProfile) !== JSON.stringify(templateProfile)
  ) {
    return "activation skipped: existing asmt-workspace profile is user-owned";
  }

  if (!current) {
    writeIfChanged(root, relativePath, templates.codexPermissions, writes);
  } else if (!currentProfile) {
    const withoutDefault = templates.codexPermissions.replace(
      /^default_permissions = "asmt-workspace"\n\n/,
      "",
    );
    const prefix = parsed.default_permissions
      ? ""
      : 'default_permissions = "asmt-workspace"\n\n';
    writeIfChanged(
      root,
      relativePath,
      `${prefix}${current.trimEnd()}\n\n${withoutDefault}`,
      writes,
    );
  }

  parseToml(readProjectFile(root, relativePath));
  return "installed and configured as default; activation unverified, not enforced";
}

export function applyInitialization(root, suppliedOptions = {}) {
  const options = {
    targets: ["claude"],
    gateCommand: "npm test",
    packageManager: "npm",
    integrationBranch: "dev",
    releaseBranch: "main",
    cardTool: "none",
    nodeSource: "package.json#engines.node",
    replaceVerification: true,
    replaceProcess: true,
    activateCodexProfile: false,
    openSpecFailure: false,
    ...suppliedOptions,
  };

  const targets = [...new Set(options.targets)];
  if (
    targets.length === 0 ||
    targets.some((host) => !Object.hasOwn(hostInvocations, host))
  ) {
    throw new Error("targets must contain claude, codex, or both");
  }
  if (!options.gateCommand) throw new Error("the verification gate must be explicit");

  for (const host of targets) validateGuidanceMarkers(root, host);
  if (options.openSpecFailure) {
    throw new Error("OpenSpec failed before ASMT-owned writes");
  }

  const completeBefore = Object.fromEntries(
    ["claude", "codex"].map((host) => [host, integrationComplete(root, host)]),
  );
  const missingTargets = targets.filter((host) => !integrationComplete(root, host));
  const openSpecChanges = installOpenSpecArtifacts(root, missingTargets);
  for (const host of targets) {
    if (!integrationComplete(root, host)) {
      throw new Error(`OpenSpec left ${host} integration incomplete`);
    }
  }
  for (const host of ["claude", "codex"]) {
    if (completeBefore[host] && !integrationComplete(root, host)) {
      throw new Error(`OpenSpec removed the complete ${host} integration`);
    }
  }

  const writes = [];
  const ciInstalled = updateVerificationWorkflow(root, options, writes);
  updateOpenSpecConfig(root, options, writes);
  updateProcessDocument(root, options, writes);

  const security = {};
  for (const host of targets) {
    updateGuidance(root, host, options.gateCommand, writes);
    if (host === "claude") {
      updateClaudeSettings(root, writes);
      security.claude = "deny list merged into Claude Code settings";
    } else {
      security.codex = codexSecurityStatus(root, options, writes);
    }
  }

  return {
    success: true,
    targets,
    missingTargets,
    openSpecChanges,
    writes,
    ciInstalled,
    security,
  };
}

export function assertInvocationContract(root, targets) {
  const process = readProjectFile(
    root,
    "docs/process/ai-dev-workflow-standard.md",
  );
  for (const host of ["claude", "codex"]) {
    const invocation = hostInvocations[host];
    for (const expected of [
      invocation.initializer,
      invocation.propose,
      invocation.archive,
    ]) {
      if (!process.includes(expected)) {
        throw new Error(`process document is missing ${expected}`);
      }
    }
  }

  for (const host of targets) {
    const guidance = readProjectFile(root, hostInvocations[host].guidance);
    if (!guidance.includes(hostInvocations[host].propose)) {
      throw new Error(`${host} guidance is missing its propose invocation`);
    }
    if (host === "codex" && /profile[^\n]*(?:is|as) enforced/i.test(guidance)) {
      throw new Error("Codex guidance overclaims permission-profile enforcement");
    }
  }
}
