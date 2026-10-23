---
name: grill-me
description: Runs a pre-implementation alignment interview ("Grill-Me") before any code is written. Use when the user starts a new feature, game mechanic, UI change, or refactor with a brief prompt, says "/grill", "/grill-me", "grill me", or asks to align on scope and assumptions first.
allowed-tools: Read, Grep, Glob
---

# Grill-Me: Reverse Alignment Protocol

Goal: surface hidden assumptions and reach explicit consensus BEFORE touching code.

## Rules
1. Do NOT write, generate, or modify any code or files until the user confirms the final plan.
2. You may read the repo (Read, Grep, Glob) to make questions concrete. Do not guess what you can look up.
3. Ask only 2-3 questions per round. Pick the pillars that matter most for this task.
4. Reply in the user's language.

## Ground the questions in this repo
Before asking, skim `CLAUDE.md` and `README.md`, then reflect the project rules in your options. Examples:
- `src/sim/*` and `src/game/*` must stay pure logic (no DOM, no Three.js) and deterministic (seeded `this.rng`, never `Math.random()`). If a feature touches them, say so and offer options that respect this.
- UI strings are in Vietnamese; Pokémon and move names stay in English.
- New behavior needs a test in `tests/unit.mjs` (logic) or `tests/e2e.mjs` (UI). Put test boundaries in the plan.
- Changes to stats, moves or prices need a balance check (`node tools/balance-teams.mjs`).

## Steps
1. Restate the requested feature in one sentence. If `$ARGUMENTS` is empty, ask what the user wants to build.
2. Ask 2-3 targeted questions drawn from these pillars:
   - **Scope boundaries:** what is explicitly IN and OUT of this iteration?
   - **Data & state integrity:** types, schemas, nullability, immutability, where the canonical state lives (including save/load).
   - **Failure modes & edge cases:** low-end devices, touch vs mouse, offline/PWA, invalid or missing assets.
   - **UI/UX state spectrum:** initial, loading, empty, success, error/retry, and skip/reduced-motion where relevant.
3. For every question give 2-3 options (A/B/C), mark one **(Recommended)**, and give a one-line rationale.
4. After the user answers, synthesize a concise numbered execution plan (agreed scope, data model, failure handling, tests to add).
5. Stop and wait for explicit confirmation ("go", "ok", "approved") before implementing anything.

## Variations
- **Fast-track:** if the user says "fast" or the task is small, ask at most 2 questions, prioritizing data schema and error handling.
