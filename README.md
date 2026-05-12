# Printable Model Demo

React/Vite demo for generating concept images, sending one image to Tripo for a printable STL, and reviewing the final STL in a model inspection bench.

## Baseline Regression Gate

Run the protected baseline before and after changes that touch:

- STL generation or download recovery
- `ModelViewer` STL geometry rendering
- the model inspection bench
- print advice for turning a single-color STL into the concept-art finish

```bash
npm run test:baseline
```

The baseline runs type checking, the STL viewer regression test, starts local API and frontend servers on temporary ports, then runs the deep-link inspection bench E2E test. It must exit non-zero on regressions.

Suggested checkpoint tag format:

```bash
git tag baseline-2026-05-12-tested
```
