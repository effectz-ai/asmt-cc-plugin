# ASMT-CC-plugin

A Claude Code plugin marketplace (`effectz`) containing one plugin, `asmt` —
the Effectz.AI standard AI-assisted development workflow: spec, plan, build,
gate, review, land.

## Install

```
claude plugin marketplace add effectz-ai/asmt-cc-plugin
claude plugin install asmt@effectz --scope project
```

## Develop

```
claude --plugin-dir ./plugins/asmt
```

## Test

```
tests/run-all
```
