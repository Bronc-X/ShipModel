import { expect, test } from "@playwright/test";

test("本地历史、会员存储和邀请联盟入口可用", async ({ page }) => {
  await page.goto("/configure");

  await expect(page.getByRole("button", { name: "本地历史" })).toBeVisible();
  await expect(page.getByRole("button", { name: "本地存储" })).toBeVisible();
  await expect(page.getByRole("button", { name: "邀请联盟" })).toBeVisible();

  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page).toHaveURL(/\/files$/);

  await page.getByRole("button", { name: "本地历史" }).click();
  await expect(page.getByRole("main")).toContainText("本地历史");
  await expect(page.getByRole("main")).toContainText("本地快照");
  await expect(page.getByRole("main")).toContainText("已保存");

  await page.getByRole("button", { name: "本地存储" }).click();
  await expect(page.getByRole("main")).toContainText("Free");
  await expect(page.getByRole("main")).toContainText("Pro");
  await page.getByRole("button", { name: "升级 Pro" }).click();
  await expect(page.getByRole("main")).toContainText("已启用 Pro");

  await page.getByRole("button", { name: "邀请联盟" }).click();
  await expect(page.getByRole("main")).toContainText("LUSIE-PILOT");
  await expect(page.getByRole("button", { name: "复制链接" })).toBeVisible();
});
