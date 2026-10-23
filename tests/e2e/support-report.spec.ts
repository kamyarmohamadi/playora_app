import { expect, test } from "@playwright/test";

test("support controls remain behind the first-launch authentication gate", async ({ page }) => {
  const supportRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/rest/v1/support_reports")) {
      supportRequests.push(request.method() + " " + request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "PLAYORA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Help & support", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Help & support" })).toHaveCount(0);

  // The unauthenticated screen cannot be dismissed to expose the dashboard.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "PLAYORA" })).toBeVisible();
  expect(supportRequests).toEqual([]);
});
