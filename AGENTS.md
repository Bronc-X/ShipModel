# Project Agent Rules

This file adds project-specific constraints on top of the global GStack protocol. Read the global Codex `AGENTS.md` first, then this file before inspecting or changing code in this repository.

## Project Shape

- Root: this directory, the `ShipModel` repository root.
- Stack: Vite, React 19, TypeScript, Express 5, Three.js, Playwright.
- Main product surfaces:
  - ToyBox printable model workflow: `src/toybox/`, `src/components/ModelViewer.tsx`, `server/`.
  - Lusie public frontend: `src/App.tsx`, `src/lusie/`, `lusie.html`, `docs/designs/`.
- AI/model pipeline:
  - OpenAI image generation lives in `server/providers/openaiImages.ts`.
  - Tripo STL generation lives in `server/providers/tripoModel.ts`.
  - Run storage and downloadable artifacts live under server storage helpers and `/runs`.

## Scenario Routing

- Large feature, new page, multi-file workflow, or core pipeline rewrite:
  - Treat as GStack Scenario A.
  - Define success criteria first.
  - Do product and engineering review before coding.
  - Pause for user approval before implementation.
- Bug, failing build, failing test, broken generation/download/viewer flow:
  - Treat as Scenario B.
  - Reproduce or identify the failing command/path first.
  - Then isolate root cause, patch, and verify.
- UI copy, spacing, color, small interaction polish:
  - Treat as Scenario C.
  - Edit only the target component/style file.
  - Verify visual behavior in browser when practical.
- Structural cleanup or component extraction:
  - Treat as Scenario D.
  - State which user-visible behavior must not change.
  - Keep refactors small and verify after each meaningful step.

## Skills To Use

- `gstack-plan-eng-review`: Use for large feature plans or architecture-impacting changes. If only the fallback bootstrap is installed, follow the global Eng Review intent manually: file list, data flow, dependency impact, complexity/risk, and verification plan.
- `test-driven-development`: Use for feature or bugfix work where behavior can be captured with tests before implementation.
- `frontend-design` and `taste-skill`: Use for non-trivial frontend UI work, especially new screens or redesigns.
- `debugging-strategies`: Use for unclear failures, flaky Playwright tests, model-generation failures, or API/pipeline issues.
- `ai-progress-workspace`: Use when changing generated-workspace/progress-event behavior, NDJSON streaming, tool logs, or artifact timelines.
- `security-auditor`: Use when touching env handling, API keys, uploads/downloads, external provider calls, CORS, or persisted run data.
- `baseline-packager`: Only when explicitly invoked by the user.
- `agent-training-loop`: Only when explicitly invoked by the user.

## Code Boundaries

- Keep changes surgical. Do not mix ToyBox workflow changes with Lusie public frontend changes unless the task explicitly spans both.
- Do not change provider contracts, run JSON shape, route names, or download URLs without updating tests and migration/recovery behavior.
- Preserve local recovery paths for `/download/:runId` and `/failed/:runId`.
- Preserve user-visible error feedback. Silent catch blocks are not acceptable.
- Do not introduce broad abstractions for one-off UI or provider changes.
- Prefer existing local helpers in `src/api.ts`, `src/toybox/`, and `server/` over new utility layers.
- Treat `dist-server/`, `node_modules/`, `test-results/`, and generated run artifacts as build/runtime output unless the user explicitly asks about them.

## Encoding And Copy

- Many user-facing strings are Chinese. When editing Chinese copy, verify the file is read and written as UTF-8.
- PowerShell output may display mojibake depending on console encoding. Do not rewrite text just because terminal output looks garbled; verify through the editor, browser, or UTF-8-aware tooling.
- Keep product copy concrete and workflow-oriented. Do not add marketing-style filler to operational screens.

## Verification

Use the smallest verification that covers the touched surface:

- Type/build gate: `npm run build`.
- ToyBox STL/viewer/download baseline: `npm run test:baseline`.
- Prompt/provider policy: `npm run test:prompts`.
- API contract: `npm run test:contract`.
- Full E2E: `npm run test:e2e`.
- Lusie build: `npm run build:lusie`.

Run `npm run test:baseline` before and after changes touching:

- Concept image generation, one-image policy, or natural-language revision.
- Prompt policy, optional marking text, or default color behavior.
- Tripo retry/proxy behavior or user-visible model failure messages.
- STL generation or download recovery.
- `ModelViewer` STL geometry rendering.
- Model inspection/download pages.
- Print advice or generated artifact handoff behavior.

For frontend changes, start the relevant dev server and inspect the actual page when feasible:

- ToyBox: `npm run dev:toybox` on port `5173`, with API on `5174` if API calls are needed.
- Lusie: `npm run dev:lusie` on port `5175`.

Before handing off code changes, check for newly introduced `console.log`, `TODO`, `FIXME`, `HACK`, or `XXX` in touched source files.
