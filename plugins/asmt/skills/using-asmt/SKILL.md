---
name: using-asmt
description: Use when starting any conversation - establishes how to find and use ASMT skills, requiring skill invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already run asmt:spec, invoke it first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## The ASMT workflow

`asmt:spec` (design) → `asmt:plan` → `asmt:build` (with `asmt:tdd`) → `asmt:verify` → `asmt:review` → `asmt:land`. `asmt:debug` for any bug or failing test, `asmt:worktrees` for isolation, `asmt:parallel` for independent problems.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. asmt:spec and asmt:debug are the most common process skills, but the rule holds for any of them.

- "Let's build X" → asmt:spec first, then implementation skills.
- "Fix this bug" → asmt:debug first, then domain skills.

## When Superpowers is also installed

In a repository with `.asmt/config.yml`, use the `asmt:*` skill and not its Superpowers counterpart (brainstorming, writing-plans, subagent-driven-development, executing-plans, test-driven-development, verification-before-completion, requesting/receiving-code-review, finishing-a-development-branch, systematic-debugging, using-git-worktrees, dispatching-parallel-agents). The ASMT versions follow the repository's config and gate; the originals do not.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Tools

Tool names and dispatch rules for Claude Code: `references/claude-code-tools.md`.

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.
