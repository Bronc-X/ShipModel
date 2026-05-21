# Printable Model Demo

React/Vite demo for generating concept images, sending one image to Tripo for a printable STL, and reviewing the final STL in a model inspection bench.

## Baseline Regression Gate

Run the protected baseline before and after changes that touch:

- concept image generation or natural-language revision
- prompt policy, optional marking text, or color defaults
- Tripo retry/proxy behavior and model failure messages
- STL generation or download recovery
- `ModelViewer` STL geometry rendering
- the model inspection bench
- print advice for turning a single-color STL into the concept-art finish

```bash
npm run test:baseline
```

The baseline runs type checking, provider/prompt/progress policy tests, the STL viewer regression test, starts local API and frontend servers on temporary ports, then runs the deep-link inspection bench E2E test. It must exit non-zero on regressions. The E2E part needs a local Playwright Chromium install; run `npx playwright install chromium` once if the browser executable is missing.

Suggested checkpoint tag format:

```bash
git tag baseline-2026-05-12-tested
```

## Generation Tuning

Concept generation uses `OPENAI_IMAGE_MODEL` and defaults to `gpt-image-2`. The flow intentionally requests one image, then uses `/api/concepts/revise` for the natural-language confirmation pass so the revision prompt can preserve the first image except for the requested changes.

Tripo generation is still dominated by the external image-to-model task. The fastest safe knobs are:

- `TRIPO_POLL_INTERVAL_MS=2000` or lower if the API rate limit allows it, reducing idle wait after a task completes.
- `TRIPO_EXPORT_UV=false`, `TRIPO_TEXTURE=false`, and `TRIPO_PBR=false` for STL-only output.
- `TRIPO_DOWNLOAD_INTERMEDIATE_GLB=false` to skip saving a GLB when it is not needed.
- For faster previews, try the official Turbo model with `TRIPO_MODEL_VERSION=Turbo-v1.0-20250506`, then compare mesh quality before using it for final printable output.
