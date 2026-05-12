import { expect, test } from "@playwright/test";

const pixel =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

test("概念图确认页默认推荐建模图，也允许改用备选图", async ({ page }) => {
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
        { phase: "image", progress: 56, message: "第 1 张已完成，正在生成第 2 张。", runId: "concept-card-test", conceptIndex: 1, totalConcepts: 2 },
        {
          phase: "complete",
          progress: 100,
          message: "概念图已生成。",
          runId: "concept-card-test",
          totalConcepts: 2,
          response: {
            runId: "concept-card-test",
            concepts: [
              {
                id: "concept-a",
                title: "推荐建模图",
                imageUrl: `data:image/png;base64,${pixel}`,
                prompt: "Create a polished studio render of a realistic modern twin-engine fighter aircraft scale model.",
                feedback: "现代战机模型主体完整、遮挡少，轮廓和落地姿态更适合交给 Tripo 生成 STL。"
              },
              {
                id: "concept-b",
                title: "备选参考图",
                imageUrl: `data:image/png;base64,${pixel}`,
                prompt: "Create a polished studio render of a realistic modern twin-engine fighter aircraft scale model.",
                feedback: "现代战机模型顶面、侧面和结构分区更清楚，适合作为备选或对照图。"
              }
            ]
          }
        }
      ].map((event) => JSON.stringify(event)).join("\n") + "\n"
    });
  });

  await page.goto("/configure");
  await page.getByRole("button", { name: "生成 2 张概念图" }).click();

  await expect(page.getByRole("progressbar", { name: "概念图生成进度" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("heading", { name: "确认建模输入图" })).toBeVisible();

  const firstCard = page.getByRole("button", { name: /推荐建模图/ });
  const secondCard = page.getByRole("button", { name: /备选参考图/ });

  await expect(firstCard).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /使用推荐图生成 STL/ })).toBeVisible();
  await expect(page.getByText("Create a polished studio render")).toHaveCount(0);

  await secondCard.click();
  await expect(secondCard).toHaveAttribute("aria-pressed", "true");
  await expect(firstCard).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /使用备选图生成 STL/ })).toBeVisible();
});
