import { expect, test } from "@playwright/test";

const pixel =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

test("概念图确认页只显示一张建模图，并允许自然语言继续改图", async ({ page }) => {
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
      body: [
        { phase: "queued", progress: 5, message: "已接收概念图生成请求。" },
        { phase: "image", progress: 84, message: "概念图已完成，正在保存结果。", runId: "concept-card-test", conceptIndex: 1, totalConcepts: 1 },
        {
          phase: "complete",
          progress: 100,
          message: "概念图已生成。",
          runId: "concept-card-test",
          totalConcepts: 1,
          response: {
            runId: "concept-card-test",
            concepts: [
              {
                id: "concept-a",
                title: "建模图",
                imageUrl: `data:image/png;base64,${pixel}`,
                prompt: "Create a polished studio render of a realistic modern twin-engine fighter aircraft scale model.",
                feedback: "现代战机模型主体完整、遮挡少，轮廓和落地姿态更适合交给 Tripo 生成 STL。"
              }
            ]
          }
        }
      ].map((event) => JSON.stringify(event)).join("\n") + "\n"
    });
  });
  await page.route("**/api/concepts/revise", async (route) => {
    const concept = {
      id: "concept-a-revised",
      title: "修改后的建模图",
      imageUrl: `data:image/png;base64,${pixel}`,
      prompt: "revised prompt",
      feedback: "已按你的描述调整：飞机的机颈再往上调 8 到 10 度。"
    };
    const run = {
      runId: "concept-card-test",
      input: {
        category: "aircraft",
        subtype: "jet",
        style: "航展涂装",
        primaryColor: "#245b70",
        accentColor: "#f3ead7",
        label: "",
        markingText: "TONI ASIA",
        description: "Create a polished studio render of a realistic modern twin-engine fighter aircraft scale model.",
        targetLengthMm: 120
      },
      concepts: [concept],
      selectedConceptId: concept.id,
      status: undefined,
      reasons: [],
      files: {},
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:01.000Z"
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        run,
        concept
      })
    });
  });

  await page.goto("/configure");
  await page.getByRole("button", { name: "生成概念图" }).click();

  await expect(page.getByRole("progressbar", { name: "概念图生成进度" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("heading", { name: "确认建模输入图" })).toBeVisible();

  const firstCard = page.getByRole("button", { name: /建模图/ });

  await expect(firstCard).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /使用这张图生成 STL/ })).toBeVisible();
  await expect(page.getByText("Create a polished studio render")).toHaveCount(0);
  await expect(page.locator(".concept-card")).toHaveCount(1);
  await expect(page.getByText("当前建模图")).toBeVisible();

  await page.getByRole("textbox", { name: "继续修改概念图" }).fill("飞机的机颈可以再往上调 8 到 10 度");
  await page.getByRole("button", { name: "提交修改" }).click();

  await expect(page.getByRole("button", { name: /修改后的建模图/ })).toBeVisible();
  await expect(page.getByText("已按你的描述调整")).toBeVisible();
});
