import { expect, test } from "@playwright/test";

test("support intake fails closed when backend configuration is absent", async ({ page }) => {
  const supportRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/rest/v1/support_reports")) {
      supportRequests.push(request.method() + " " + request.url());
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Help & support", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Help & support" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText(
    "Support submissions are not connected yet. Please try again after the service is enabled."
  );
  await expect(dialog.getByRole("button", { name: "Submit report" })).toHaveCount(0);
  await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveCount(0);

  // No form and no feature flag means opening/closing support must not write anything.
  await expect.poll(() => supportRequests.length).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(supportRequests).toEqual([]);
});
