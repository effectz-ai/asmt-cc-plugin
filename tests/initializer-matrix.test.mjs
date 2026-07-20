import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyInitialization,
  assertInvocationContract,
  detectProjectInputs,
  exists,
  installOpenSpecArtifacts,
  integrationComplete,
  readProjectFile,
  snapshotProject,
  writeProjectFile,
} from "./helpers/project-contract.mjs";

const requiredWorkflowSkills = [
  "openspec-explore",
  "openspec-propose",
  "openspec-apply-change",
  "openspec-sync-specs",
  "openspec-archive-change",
  "openspec-update-change",
];

const defaultOptions = {
  gateCommand: "npm run lint && npm run check-types && npm test",
  packageManager: "npm",
  integrationBranch: "dev",
  releaseBranch: "main",
  cardTool: "none",
  nodeSource: "package.json#engines.node",
};

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commit(root, message) {
  git(root, ["add", "-A"]);
  git(root, [
    "-c",
    "user.name=ASMT Release Tests",
    "-c",
    "user.email=asmt-tests@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    message,
  ]);
}

function createRepository(setup = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asmt-matrix-"));
  git(root, ["init", "--quiet"]);
  writeProjectFile(
    root,
    "package.json",
    `${JSON.stringify(
      {
        name: "matrix-fixture",
        description: "ASMT release matrix fixture",
        private: true,
        packageManager: "npm@11.12.1",
        engines: { node: ">=20.19.0" },
        scripts: {
          lint: "node --check index.js",
          "check-types": "node --check index.js",
          test: "node --test",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeProjectFile(root, "package-lock.json", '{"lockfileVersion":3}\n');
  writeProjectFile(root, "index.js", "export const fixture = true;\n");
  setup(root);
  commit(root, "fixture baseline");
  return root;
}

function assertHostArtifacts(root, hosts) {
  assert.ok(exists(root, ".github/workflows/verify.yml"));
  assert.ok(exists(root, "docs/process/ai-dev-workflow-standard.md"));
  assert.ok(
    exists(root, "openspec/config.yaml") || exists(root, "openspec/config.yml"),
  );

  for (const host of hosts) {
    assert.ok(integrationComplete(root, host), `${host} OpenSpec must be complete`);
    assert.ok(exists(root, host === "claude" ? "CLAUDE.md" : "AGENTS.md"));
    for (const skill of requiredWorkflowSkills) {
      assert.ok(exists(root, `.${host}/skills/${skill}/SKILL.md`));
    }
  }

  assertInvocationContract(root, hosts);
  for (const relativePath of [
    ".github/workflows/verify.yml",
    "docs/process/ai-dev-workflow-standard.md",
    ...hosts.map((host) => (host === "claude" ? "CLAUDE.md" : "AGENTS.md")),
  ]) {
    assert.doesNotMatch(readProjectFile(root, relativePath), /\{\{[A-Z0-9_]+\}\}/);
  }
}

function assertIdempotent(root, options) {
  const firstRunState = snapshotProject(root);
  commit(root, "first ASMT initialization");
  const rerun = applyInitialization(root, options);
  assert.deepEqual(snapshotProject(root), firstRunState);
  assert.equal(git(root, ["status", "--porcelain"]), "");
  assert.deepEqual(rerun.openSpecChanges, []);
  assert.deepEqual(rerun.writes, []);
}

function successfulScenario(name, definition) {
  test(name, () => {
    const root = createRepository(definition.setup);
    try {
      const runs = definition.runs ?? [definition.options];
      const results = [];
      const states = [];
      for (const supplied of runs) {
        results.push(
          applyInitialization(root, { ...defaultOptions, ...supplied }),
        );
        states.push(snapshotProject(root));
      }

      const expectedHosts = definition.expectedHosts ?? runs.at(-1).targets;
      assertHostArtifacts(root, expectedHosts);
      definition.assertions?.(root, results, states);

      const finalResult = results.at(-1);
      if (finalResult.security.codex) {
        assert.doesNotMatch(finalResult.security.codex, /^enforced$/i);
      }
      assertIdempotent(root, { ...defaultOptions, ...runs.at(-1) });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

successfulScenario("Claude: fresh initialization", {
  options: { targets: ["claude"] },
  assertions(root) {
    assert.ok(exists(root, ".claude/settings.json"));
    assert.match(readProjectFile(root, "CLAUDE.md"), /\/asmt:lanes/);
    assert.ok(!exists(root, "AGENTS.md"));
    assert.ok(!exists(root, ".codex/skills"));
  },
});

successfulScenario("Claude: explicit rerun", {
  options: { targets: ["claude"] },
  assertions(root) {
    const before = snapshotProject(root);
    const rerun = applyInitialization(root, {
      ...defaultOptions,
      targets: ["claude"],
    });
    assert.deepEqual(snapshotProject(root), before);
    assert.deepEqual(rerun.writes, []);
  },
});

successfulScenario("Claude: existing CLAUDE.md user content", {
  setup(root) {
    writeProjectFile(root, "CLAUDE.md", "# Team guidance\n\nKeep this paragraph.\n");
  },
  options: { targets: ["claude"] },
  assertions(root) {
    const content = readProjectFile(root, "CLAUDE.md");
    assert.match(content, /^# Team guidance/);
    assert.match(content, /Keep this paragraph\./);
    assert.equal(content.split("<!-- asmt:start -->").length - 1, 1);
  },
});

successfulScenario("Claude: settings deep merge", {
  setup(root) {
    writeProjectFile(
      root,
      ".claude/settings.json",
      `${JSON.stringify(
        {
          model: "sonnet",
          permissions: {
            allow: ["Read(src/**)"],
            deny: ["Read(private/**)", "Read(**/.env)"],
          },
        },
        null,
        2,
      )}\n`,
    );
  },
  options: { targets: ["claude"] },
  assertions(root) {
    const settings = JSON.parse(readProjectFile(root, ".claude/settings.json"));
    assert.equal(settings.model, "sonnet");
    assert.deepEqual(settings.permissions.allow, ["Read(src/**)"]);
    assert.ok(settings.permissions.deny.includes("Read(private/**)"));
    assert.equal(
      settings.permissions.deny.filter((entry) => entry === "Read(**/.env)").length,
      1,
    );
  },
});

successfulScenario("Claude: complete existing OpenSpec integration", {
  setup(root) {
    installOpenSpecArtifacts(root, ["claude"]);
    writeProjectFile(root, "openspec/specs/user-owned.md", "preserve me\n");
  },
  options: { targets: ["claude"] },
  assertions(root, [result]) {
    assert.deepEqual(result.openSpecChanges, []);
    assert.equal(readProjectFile(root, "openspec/specs/user-owned.md"), "preserve me\n");
  },
});

successfulScenario("Claude: custom openspec/config.yml", {
  setup(root) {
    installOpenSpecArtifacts(root, ["claude"]);
    fs.unlinkSync(path.join(root, "openspec/config.yaml"));
    writeProjectFile(
      root,
      "openspec/config.yml",
      [
        "schema: spec-driven",
        "context: User-authored domain context",
        "rules:",
        "  proposal:",
        "    - Keep the team's custom rule",
        "",
      ].join("\n"),
    );
  },
  options: { targets: ["claude"] },
  assertions(root) {
    assert.ok(!exists(root, "openspec/config.yaml"));
    const config = readProjectFile(root, "openspec/config.yml");
    assert.match(config, /User-authored domain context/);
    assert.match(config, /Keep the team's custom rule/);
  },
});

successfulScenario("Claude: approved user verification-workflow replacement", {
  setup(root) {
    writeProjectFile(
      root,
      ".github/workflows/verify.yml",
      "name: User workflow\non: push\n",
    );
  },
  options: { targets: ["claude"], replaceVerification: true },
  assertions(root, [result]) {
    const workflow = readProjectFile(root, ".github/workflows/verify.yml");
    assert.doesNotMatch(workflow, /User workflow/);
    assert.match(workflow, /Generated by the ASMT workflow initializer/);
    assert.equal(result.ciInstalled, true);
  },
});

successfulScenario("Claude: declined user verification-workflow replacement", {
  setup(root) {
    writeProjectFile(
      root,
      ".github/workflows/verify.yml",
      "name: User workflow\non: push\n",
    );
  },
  options: { targets: ["claude"], replaceVerification: false },
  assertions(root, [result]) {
    assert.equal(
      readProjectFile(root, ".github/workflows/verify.yml"),
      "name: User workflow\non: push\n",
    );
    assert.equal(result.ciInstalled, false);
  },
});

successfulScenario("Codex: fresh Codex-only initialization", {
  options: { targets: ["codex"], activateCodexProfile: true },
  assertions(root, [result]) {
    assert.ok(exists(root, ".codex/config.toml"));
    assert.match(result.security.codex, /activation unverified, not enforced/);
    assert.match(
      readProjectFile(root, "AGENTS.md"),
      /only when\s+Codex has successfully loaded/,
    );
    assert.ok(!exists(root, "CLAUDE.md"));
    assert.ok(!exists(root, ".claude/settings.json"));
  },
});

successfulScenario("Cross-platform: initialize both hosts", {
  options: { targets: ["claude", "codex"], activateCodexProfile: false },
  expectedHosts: ["claude", "codex"],
  assertions(root) {
    assert.ok(exists(root, "CLAUDE.md"));
    assert.ok(exists(root, "AGENTS.md"));
  },
});

successfulScenario("Cross-platform: Claude then Codex", {
  runs: [
    { targets: ["claude"] },
    { targets: ["codex"], activateCodexProfile: false },
  ],
  expectedHosts: ["claude", "codex"],
  assertions(root, results, states) {
    assert.equal(results[0].missingTargets[0], "claude");
    assert.equal(results[1].missingTargets[0], "codex");
    for (const commonPath of [
      ".github/workflows/verify.yml",
      "docs/process/ai-dev-workflow-standard.md",
      "openspec/config.yaml",
    ]) {
      assert.equal(states[0][commonPath], states[1][commonPath]);
    }
    assert.match(readProjectFile(root, "CLAUDE.md"), /\/opsx:propose/);
    assert.match(readProjectFile(root, "AGENTS.md"), /\$openspec-propose/);
  },
});

successfulScenario("Cross-platform: Codex then Claude", {
  runs: [
    { targets: ["codex"], activateCodexProfile: false },
    { targets: ["claude"] },
  ],
  expectedHosts: ["claude", "codex"],
  assertions(root, results, states) {
    assert.equal(results[0].missingTargets[0], "codex");
    assert.equal(results[1].missingTargets[0], "claude");
    for (const commonPath of [
      ".github/workflows/verify.yml",
      "docs/process/ai-dev-workflow-standard.md",
      "openspec/config.yaml",
    ]) {
      assert.equal(states[0][commonPath], states[1][commonPath]);
    }
    assert.ok(exists(root, ".claude/settings.json"));
  },
});

successfulScenario("Cross-platform: incomplete OpenSpec integrations are extended", {
  setup(root) {
    installOpenSpecArtifacts(root, []);
    writeProjectFile(
      root,
      ".claude/skills/openspec-propose/SKILL.md",
      "pre-existing claude artifact\n",
    );
    writeProjectFile(
      root,
      ".codex/skills/openspec-apply-change/SKILL.md",
      "pre-existing codex artifact\n",
    );
  },
  options: { targets: ["claude", "codex"], activateCodexProfile: false },
  expectedHosts: ["claude", "codex"],
  assertions(root) {
    assert.equal(
      readProjectFile(root, ".claude/skills/openspec-propose/SKILL.md"),
      "pre-existing claude artifact\n",
    );
    assert.equal(
      readProjectFile(root, ".codex/skills/openspec-apply-change/SKILL.md"),
      "pre-existing codex artifact\n",
    );
  },
});

test("Detection: conflicting lockfiles require an explicit package manager", () => {
  const root = createRepository((fixture) => {
    const packageJson = JSON.parse(readProjectFile(fixture, "package.json"));
    delete packageJson.packageManager;
    writeProjectFile(fixture, "package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
    writeProjectFile(fixture, "yarn.lock", "# yarn lockfile\n");
  });
  try {
    const detected = detectProjectInputs(root);
    assert.equal(detected.packageManager, undefined);
    assert.deepEqual(detected.packageManagerConflict, ["yarn", "npm"]);
    assert.equal(detected.gateCommand, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Detection: missing scripts never fabricate a gate", () => {
  const root = createRepository((fixture) => {
    const packageJson = JSON.parse(readProjectFile(fixture, "package.json"));
    packageJson.scripts = { build: "node index.js" };
    writeProjectFile(fixture, "package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
  });
  try {
    const detected = detectProjectInputs(root);
    assert.equal(detected.packageManager, "npm");
    assert.deepEqual(detected.selectedScripts, []);
    assert.equal(detected.gateCommand, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Failure: malformed ASMT markers stop without repository changes", () => {
  const root = createRepository((fixture) => {
    writeProjectFile(fixture, "CLAUDE.md", "user text\n<!-- asmt:start -->\n");
  });
  try {
    const before = snapshotProject(root);
    assert.throws(
      () =>
        applyInitialization(root, {
          ...defaultOptions,
          targets: ["claude"],
        }),
      /malformed ASMT markers/,
    );
    assert.deepEqual(snapshotProject(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Failure: OpenSpec failure stops before ASMT-owned writes", () => {
  const root = createRepository();
  try {
    const before = snapshotProject(root);
    assert.throws(
      () =>
        applyInitialization(root, {
          ...defaultOptions,
          targets: ["claude", "codex"],
          openSpecFailure: true,
        }),
      /OpenSpec failed before ASMT-owned writes/,
    );
    assert.deepEqual(snapshotProject(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

successfulScenario("Codex: legacy sandbox settings skip profile activation", {
  setup(root) {
    writeProjectFile(root, ".codex/config.toml", 'sandbox_mode = "workspace-write"\n');
  },
  options: { targets: ["codex"], activateCodexProfile: true },
  assertions(root, [result]) {
    assert.equal(
      readProjectFile(root, ".codex/config.toml"),
      'sandbox_mode = "workspace-write"\n',
    );
    assert.match(result.security.codex, /legacy sandbox settings/);
  },
});

successfulScenario("Codex: existing default_permissions is preserved", {
  setup(root) {
    writeProjectFile(
      root,
      ".codex/config.toml",
      [
        'default_permissions = "team-profile"',
        "",
        "[permissions.team-profile]",
        'extends = ":read-only"',
        "",
      ].join("\n"),
    );
  },
  options: { targets: ["codex"], activateCodexProfile: true },
  assertions(root, [result]) {
    assert.match(readProjectFile(root, ".codex/config.toml"), /team-profile/);
    assert.doesNotMatch(readProjectFile(root, ".codex/config.toml"), /asmt-workspace/);
    assert.match(result.security.codex, /existing default_permissions preserved/);
  },
});

successfulScenario("Codex: declined profile activation creates no policy file", {
  options: { targets: ["codex"], activateCodexProfile: false },
  assertions(root, [result]) {
    assert.ok(!exists(root, ".codex/config.toml"));
    assert.match(result.security.codex, /activation declined/);
    assert.match(result.security.codex, /not installed or enforced/);
  },
});
