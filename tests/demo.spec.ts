import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const realProvidersConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.TRIPO_API_KEY);
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:5174";
const pixel = "iVBORw0KGgo=";

function conceptStreamBody(runId: string) {
  return [
    { phase: "queued", progress: 5, message: "已接收概念图生成请求。" },
    { phase: "image", progress: 84, message: "概念图已完成，正在保存结果。", runId, conceptIndex: 1, totalConcepts: 1 },
    {
      phase: "complete",
      progress: 100,
      message: "概念图已生成。",
      runId,
      totalConcepts: 1,
      response: {
        runId,
        concepts: [
          {
            id: `${runId}-a`,
            title: "建模图",
            imageUrl: `data:image/png;base64,${pixel}`,
            prompt: "test"
          }
        ]
      }
    }
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function writeReadyRun(runId: string) {
  const runDir = path.resolve("runs", runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        runId,
        input: {
          category: "aircraft",
          subtype: "airliner",
          style: "航展涂装",
          primaryColor: "#245b70",
          accentColor: "#f3ead7",
          label: "",
          markingText: "TONI ASIA",
          description: "用于进度页完成态测试的客机模型。",
          targetLengthMm: 120
        },
        concepts: [
          {
            id: `${runId}-concept-a`,
            title: "建模图",
            imageUrl: `data:image/png;base64,${pixel}`,
            prompt: "test"
          }
        ],
        selectedConceptId: `${runId}-concept-a`,
        status: "Ready",
        reasons: [],
        files: {
          stl: `/runs/${runId}/model.stl`
        },
        createdAt: "2026-05-12T00:00:00.000Z",
        updatedAt: "2026-05-12T00:00:00.000Z"
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(runDir, "model.stl"), "solid ready-run\nfacet normal 0 0 0\nendfacet\nendsolid ready-run\n", "utf8");
}

test("根路径会进入配置页", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/configure$/);
  await expect(page.getByRole("button", { name: "Lusie ai" })).toBeVisible();
});

test("STL 生成进度会包含局部渲染阶段", async ({ page }) => {
  await page.goto("/generate");

  await expect(page.getByRole("heading", { name: "正在生成 STL 模型" })).toBeVisible();
  const pipeline = page.getByRole("region", { name: "模型生成阶段" });
  await expect(pipeline.getByText("局部渲染与细节取样", { exact: true })).toBeVisible();
  await expect(pipeline.getByText("模型拆解图会和 STL 一起进入检查台。")).toBeVisible();
});

test("STL 进度展示真实后端事件流并完成交付", async ({ page }) => {
  await page.route("**/api/handshake", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        app: "printable-model-demo",
        apiVersion: "0.1.0",
        mode: { imageProvider: "openai", modelProvider: "tripo" },
        configured: { openai: true, tripo: true },
        capabilities: {
          conceptImages: true,
          modelGeneration: true,
          stlDownload: true,
          threeMfDownload: false,
          statuses: ["Ready", "Failed"]
        }
      })
    });
  });
  await page.route("**/api/concepts", async (route) => {
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: conceptStreamBody("stl-progress-mock")
    });
  });
  await page.route("**/api/models", async (route) => {
    const run = {
      runId: "stl-progress-mock",
      input: {
        category: "aircraft",
        subtype: "airliner",
        style: "航展涂装",
        primaryColor: "#245b70",
        accentColor: "#f3ead7",
        label: "",
        markingText: "TONI ASIA",
        description: "用于真实事件流测试的客机模型。",
        targetLengthMm: 120
      },
      concepts: [
        {
          id: "stl-progress-mock-a",
          title: "建模图",
          imageUrl: `data:image/png;base64,${pixel}`,
          prompt: "test"
        }
      ],
      selectedConceptId: "stl-progress-mock-a",
      status: "Ready",
      reasons: [],
      files: {
        stl: "/runs/stl-progress-mock/model.stl"
      },
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:00.000Z"
    };
    const events = [
      { type: "job.started", jobId: run.runId, title: "生成 STL 模型", at: "2026-05-12T00:00:00.000Z" },
      { type: "tool.started", jobId: run.runId, callId: "tripo_generate_model", name: "tripo_image_to_model", inputSummary: "建模图", at: "2026-05-12T00:00:01.000Z" },
      { type: "tool.completed", jobId: run.runId, callId: "tripo_generate_model", name: "tripo_image_to_model", outputSummary: "model.stl", at: "2026-05-12T00:00:02.000Z" },
      { type: "tool.started", jobId: run.runId, callId: "validate_stl", name: "validate_stl", inputSummary: "model.stl", at: "2026-05-12T00:00:03.000Z" },
      { type: "tool.completed", jobId: run.runId, callId: "validate_stl", name: "validate_stl", outputSummary: "STL 文件通过基础校验", at: "2026-05-12T00:00:04.000Z" },
      { type: "artifact.created", jobId: run.runId, artifactId: `${run.runId}:stl`, kind: "stl", title: "可下载 STL 文件", data: { href: run.files.stl }, at: "2026-05-12T00:00:05.000Z" },
      { type: "job.completed", jobId: run.runId, at: "2026-05-12T00:00:06.000Z", response: { run } }
    ];
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((event) => JSON.stringify(event)).join("\n") + "\n"
    });
  });

  await page.goto("/configure");
  await page.getByRole("button", { name: "生成概念图" }).click();
  await expect(page).toHaveURL(/\/concept$/);
  await page.getByRole("button", { name: "使用这张图生成 STL" }).click();
  await expect(page).toHaveURL(/\/generate$/);

  await expect(page.getByText("真实任务进度")).toBeVisible();
  await expect(page.getByText("等待后端工具事件")).toBeVisible();
  await expect(page).toHaveURL(/\/download\/stl-progress-mock$/);
  await expect(page.getByRole("heading", { name: "模型检查台" })).toBeVisible();
});

test("STL 失败事件流不会显示模型生成完成", async ({ page }) => {
  await page.route("**/api/handshake", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        app: "printable-model-demo",
        apiVersion: "0.1.0",
        mode: { imageProvider: "openai", modelProvider: "tripo" },
        configured: { openai: true, tripo: false },
        capabilities: {
          conceptImages: true,
          modelGeneration: true,
          stlDownload: true,
          threeMfDownload: false,
          statuses: ["Ready", "Failed"]
        }
      })
    });
  });
  await page.route("**/api/concepts", async (route) => {
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: conceptStreamBody("stl-progress-failed")
    });
  });
  await page.route("**/api/models", async (route) => {
    const run = {
      runId: "stl-progress-failed",
      input: {
        category: "aircraft",
        subtype: "airliner",
        style: "航展涂装",
        primaryColor: "#245b70",
        accentColor: "#f3ead7",
        label: "",
        markingText: "TONI ASIA",
        description: "用于真实失败事件流测试的客机模型。",
        targetLengthMm: 120
      },
      concepts: [
        {
          id: "stl-progress-failed-a",
          title: "建模图",
          imageUrl: `data:image/png;base64,${pixel}`,
          prompt: "test"
        }
      ],
      selectedConceptId: "stl-progress-failed-a",
      status: "Failed",
      reasons: ["生成可打印模型前，请先设置 TRIPO_API_KEY。"],
      files: {},
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:00.000Z"
    };
    const events = [
      { type: "job.started", jobId: run.runId, title: "生成 STL 模型", at: "2026-05-12T00:00:00.000Z" },
      { type: "step.started", jobId: run.runId, stepId: "select_concept", title: "锁定概念图和打印参数", at: "2026-05-12T00:00:01.000Z" },
      { type: "step.failed", jobId: run.runId, stepId: "model_generation", error: "生成可打印模型前，请先设置 TRIPO_API_KEY。", recoverable: true, at: "2026-05-12T00:00:02.000Z" },
      { type: "job.completed", jobId: run.runId, at: "2026-05-12T00:00:03.000Z", response: { run } }
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((event) => JSON.stringify(event)).join("\n") + "\n"
    });
  });

  await page.goto("/configure");
  await page.getByRole("button", { name: "生成概念图" }).click();
  await page.getByRole("button", { name: "使用这张图生成 STL" }).click();

  await expect(page).toHaveURL(/\/failed\/stl-progress-failed$/);
  await expect(page.getByRole("heading", { name: "这次没有生成成功" })).toBeVisible();
  await expect(page.getByText("生成可打印模型前，请先设置 TRIPO_API_KEY。")).toBeVisible();
  await expect(page.getByText("模型生成完成")).toHaveCount(0);
});

test("STL 已就绪后回看生成页不会重新提交生成任务", async ({ page }) => {
  const runId = "ready-run-no-fake-progress";
  await writeReadyRun(runId);
  let modelRequests = 0;

  await page.route("**/api/models", async (route) => {
    modelRequests += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "should not run" }) });
  });

  await page.goto(`/download/${runId}`);
  await expect(page.getByRole("heading", { name: "模型检查台" })).toBeVisible();

  await page.getByRole("button", { name: "生成 STL", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/download/${runId}$`));
  await expect(page.getByRole("heading", { name: "模型检查台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "正在生成 STL 模型" })).toHaveCount(0);
  expect(modelRequests).toBe(0);
});

test("右侧功能入口进入可操作子界面", async ({ page }) => {
  await page.goto("/configure");

  await expect(page.getByRole("button", { name: "文件", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "编辑", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "视图", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "窗口", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page).toHaveURL(/\/files$/);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "文件中枢" })).toBeVisible();
  await page.getByRole("radio", { name: "项目快照" }).check();
  await page.getByLabel("文件名").fill("下一轮需要保留真实外形和双色涂装。");
  await page.getByRole("button", { name: "执行文件任务" }).click();
  const fileStatus = page.getByRole("status", { name: "文件中枢任务状态" });
  await expect(fileStatus).toContainText("正在处理");
  await expect(fileStatus).toContainText("文件任务已完成");

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible();
  await page.getByRole("radio", { name: "供应商状态" }).check();
  await page.getByLabel("设置备注").fill("优先检查 OpenAI 与 Tripo 连接。");
  await page.getByRole("button", { name: "执行设置任务" }).click();
  await expect(page.getByRole("status", { name: "系统设置任务状态" })).toContainText("设置任务已完成");

  await page.getByRole("button", { name: "提问" }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "提问中心" })).toBeVisible();
  await page.getByRole("radio", { name: "工作流介绍" }).check();
  await page.getByLabel("问题").fill("从概念图到 STL 中间有哪些检查点？");
  await page.getByRole("button", { name: "提交问题" }).click();
  await expect(page.getByRole("status", { name: "提问中心任务状态" })).toContainText("提问任务已完成");

  await page.getByRole("button", { name: "个人" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "个人空间" })).toBeVisible();
  await page.getByRole("radio", { name: "生成偏好" }).check();
  await page.getByLabel("个人备注").fill("默认偏向真实载具和可打印结构。");
  await page.getByRole("button", { name: "更新个人空间" }).click();
  await expect(page.getByRole("status", { name: "个人空间任务状态" })).toContainText("个人任务已完成");

  await page.getByRole("button", { name: "Lusie ai" }).click();
  await expect(page).toHaveURL(/\/configure$/);
});

test("完整工作台壳层入口都可见并能响应", async ({ page }) => {
  await page.goto("/configure");

  await expect(page.locator("a:not([href])")).toHaveCount(0);
  await expect(page.locator("button:visible:disabled")).toHaveCount(0);

  await expect(page.getByRole("button", { name: "文件", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "编辑", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "视图", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "窗口", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出 STL" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存配置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "提问" })).toBeVisible();

  await expect(page.getByRole("button", { name: "参数", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "选图", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成 STL", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 STL", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "本地历史" })).toBeVisible();
  await expect(page.getByRole("button", { name: "本地存储" })).toBeVisible();

  await expect(page.getByTitle("参数预览")).toBeVisible();
  await expect(page.getByTitle("真实线框比例")).toBeVisible();

  await page.getByRole("button", { name: "参数", exact: true }).click();
  await expect(page).toHaveURL(/\/configure$/);

  await page.getByRole("button", { name: "导出 STL" }).click();
  await expect(page).toHaveURL(/\/files$/);
  await expect(page.getByRole("alert")).toContainText("STL 生成完成后才能导出。");

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("button", { name: "个人" }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page).toHaveURL(/\/files$/);
  await expect(page.getByText("当前配置已保存到此浏览器。")).toBeVisible();

  await page.getByRole("button", { name: "提问" }).click();
  await expect(page.getByRole("heading", { name: "提问中心" })).toBeVisible();

  await page.goto("/configure");
  await page.getByRole("button", { name: "本地历史" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("main")).toContainText("已找到 1 个本地快照");

  await page.getByRole("button", { name: "本地存储" }).click();
  await expect(page).toHaveURL(/\/storage$/);
  await expect(page.getByRole("main")).toContainText("本地已保存 1 个项目快照");

  await page.goto("/configure");
  await page.getByTitle("参数预览").click();
  await expect(page.getByRole("status")).toContainText("已切换到概念预览。");

  await page.getByTitle("真实线框比例").click();
  await expect(page.getByRole("status")).toContainText("已切换到尺寸网格。");

  await page.getByRole("button", { name: "选图", exact: true }).click();
  await expect(page).toHaveURL(/\/configure$/);
  await expect(page.getByRole("alert")).toContainText("请先生成概念图，再进入方案选择。");

  await page.getByRole("button", { name: "生成 STL", exact: true }).click();
  await expect(page).toHaveURL(/\/configure$/);
  await expect(page.getByRole("alert")).toContainText("请先生成并选择概念图，再提交 STL。");

  await page.getByRole("button", { name: "下载 STL", exact: true }).click();
  await expect(page).toHaveURL(/\/configure$/);
  await expect(page.getByRole("alert")).toContainText("STL 生成完成后才能下载。");

  await page.getByRole("button", { name: "新建版本" }).click();
  await expect(page).toHaveURL(/\/configure$/);
});

test("个性化信息默认留空，主色和辅助色默认黑色并随概念图请求提交", async ({ page }) => {
  let postedBody: Record<string, unknown> | null = null;

  await page.route("**/api/handshake", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        app: "printable-model-demo",
        apiVersion: "0.1.0",
        mode: { imageProvider: "openai", modelProvider: "tripo" },
        configured: { openai: true, tripo: true },
        capabilities: {
          conceptImages: true,
          modelGeneration: true,
          stlDownload: true,
          threeMfDownload: false,
          statuses: ["Ready", "Failed"]
        }
      })
    });
  });

  await page.route("**/api/concepts", async (route) => {
    postedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: conceptStreamBody("accent-color-test")
    });
  });

  await page.goto("/configure");
  await page.getByRole("button", { name: "生成概念图" }).click();

  await expect.poll(() => postedBody?.primaryColor).toBe("#050505");
  await expect.poll(() => postedBody?.accentColor).toBe("#050505");
  await expect.poll(() => postedBody?.markingText).toBe("");
});

test("返回参数页调整 250mm 后可以再次生成概念图", async ({ page }) => {
  const postedBodies: Record<string, unknown>[] = [];

  await page.route("**/api/handshake", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        app: "printable-model-demo",
        apiVersion: "0.1.0",
        mode: { imageProvider: "openai", modelProvider: "tripo" },
        configured: { openai: true, tripo: true },
        capabilities: {
          conceptImages: true,
          modelGeneration: true,
          stlDownload: true,
          threeMfDownload: false,
          statuses: ["Ready", "Failed"]
        }
      })
    });
  });

  await page.route("**/api/concepts", async (route) => {
    postedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: conceptStreamBody(`dimension-regression-${postedBodies.length}`)
    });
  });

  await page.goto("/configure");
  await page.getByRole("button", { name: "生成概念图" }).click();
  await expect(page).toHaveURL(/\/concept$/);

  await page.getByRole("button", { name: "返回修改参数" }).click();
  await expect(page).toHaveURL(/\/configure$/);

  await page.getByLabel("X Axis").fill("250");
  await page.getByRole("button", { name: "生成概念图" }).click();

  await expect(page).toHaveURL(/\/concept$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => postedBodies.at(-1)?.targetLengthMm).toBe(250);
});

test("缺少供应商密钥时走真实错误路径", async ({ page, request }) => {
  const handshake = await (await request.get(`${apiBaseUrl}/api/handshake`)).json();
  test.skip(handshake.configured.openai, "This assertion only applies when OPENAI_API_KEY is absent.");

  await page.goto("/configure");
  await expect(page.getByText(/openai:缺失/i)).toBeVisible();

  await page.getByRole("button", { name: "生成概念图" }).click();
  await expect(page).toHaveURL(/\/configure$/);
  await expect(page.getByRole("alert")).toContainText("生成概念图前，请先设置 OPENAI_API_KEY。");
  await expect(page.getByText("建模图")).toHaveCount(0);
});

test("真实供应商可以生成概念图、创建 STL 并预览非空 3D 模型", async ({ page }) => {
  test.skip(!realProvidersConfigured, "Requires real OPENAI_API_KEY and TRIPO_API_KEY.");

  await page.goto("/configure");

  await page.getByRole("button", { name: "舰船" }).click();
  await page.getByRole("button", { name: "现代军舰 驱逐舰/护卫舰轮廓" }).click();
  await page
    .getByPlaceholder("写清外形参考、结构强度、可打印细节，例如加厚机翼或稳固甲板。")
    .fill("一艘紧凑的仪式感战舰，带有稳固的展示船体。");
  await page.getByRole("button", { name: "生成概念图" }).click();

  await expect(page).toHaveURL(/\/concept$/);
  await expect(page.getByText("建模图")).toBeVisible();
  await expect(page.locator(".concept-card")).toHaveCount(1);
  await expect(page.getByText("当前建模图")).toBeVisible();

  await page.getByRole("button", { name: "使用这张图生成 STL" }).click();

  await expect(page).toHaveURL(/\/download|\/failed$/, { timeout: 600_000 });

  if (page.url().endsWith("/failed")) {
    await expect(page.getByText("这次没有生成成功")).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { name: "模型检查台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "结构拆解" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "打印建议" })).toBeVisible();
  await expect(page.getByRole("link", { name: "下载 STL 文件" })).toHaveAttribute("href", /download\/stl/);

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const sample = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const context = canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl");
    return {
      width: canvasElement.width,
      height: canvasElement.height,
      hasContext: Boolean(context)
    };
  });
  expect(sample.hasContext).toBe(true);
  expect(sample.width).toBeGreaterThan(100);
  expect(sample.height).toBeGreaterThan(100);
});
