import { expect, test } from "@playwright/test";

test("Toy-Box and Lusie expose separate frontends", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Lusie ai" })).toBeVisible();
  await expect(page.getByRole("button", { name: "参数", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "选图", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成 STL", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 STL", exact: true })).toBeVisible();

  await page.goto("http://localhost:5175/");
  await expect(page.getByText("Lusie").first()).toBeVisible();
});
