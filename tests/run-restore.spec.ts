import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const readyRunId = "deep-link-ready-run";
const runDir = path.resolve("runs", readyRunId);

test("可以通过 runId 深链接恢复下载页", async ({ page }) => {
  const readyRun = {
    runId: readyRunId,
    input: {
      category: "vehicle",
      subtype: "race-car",
      style: "赛道日",
      primaryColor: "#e11d48",
      accentColor: "#facc15",
      label: "07",
      description: "用于深链接恢复测试的模型。",
      targetLengthMm: 120
    },
    concepts: [
      {
        id: "concept-a-deep",
        title: "恢复测试概念图",
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
        prompt: "test"
      }
    ],
    selectedConceptId: "concept-a-deep",
    status: "Ready",
    reasons: [],
    files: {
      stl: `/runs/${readyRunId}/model.stl`
    },
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z"
  };

  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "run.json"), JSON.stringify(readyRun, null, 2), "utf8");
  await writeFile(path.join(runDir, "model.stl"), "solid deep-link-ready-run\nendsolid deep-link-ready-run\n", "utf8");

  await page.goto(`/download/${readyRunId}`);

  await expect(page).toHaveURL(new RegExp(`/download/${readyRunId}$`));
  await expect(page.getByRole("heading", { name: "模型检查台" })).toBeVisible();
  await expect(page.getByText("当前显示的是 STL 几何预览，不是概念图材质还原。")).toBeVisible();
  await expect(page.getByText("概念图仅作建模参考")).toBeVisible();
  await expect(page.getByRole("heading", { name: "局部渲染样张" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "结构拆解" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "打印建议" })).toBeVisible();
  await expect(page.getByText("先按单色 STL 打印几何体，再通过打磨、底漆、遮盖喷涂和手涂细节还原效果图配色。")).toBeVisible();

  const sideViewButton = page.getByRole("button", { name: "侧视", exact: true });
  await sideViewButton.click();
  await expect(sideViewButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status", { name: "当前局部渲染" })).toContainText("侧视姿态");

  await expect(page.getByRole("main").getByRole("link", { name: "下载 STL 文件" })).toHaveAttribute(
    "href",
    `/api/runs/${readyRunId}/download/stl`
  );
});
