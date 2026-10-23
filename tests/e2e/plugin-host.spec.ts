import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const ARTIFACT_ORIGIN = "https://games.playora.example";
const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "plugin-fixture.html");
const fixtureHtml = readFileSync(fixturePath, "utf8");

test.beforeEach(async ({ page }) => {
  await page.route(ARTIFACT_ORIGIN + "/**", route => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: { "cache-control": "no-store" },
    body: fixtureHtml,
  }));
  await page.route("https://evil.example/**", route => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<!doctype html><title>Unexpected document</title><body>Unexpected navigation target</body>",
  }));
});

test("the unauthenticated launch screen blocks catalogue access and game launch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "PLAYORA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Explore games", exact: true })).toHaveCount(0);
  await expect(page.locator("iframe.playora-plugin-host__frame")).toHaveCount(0);
});

test("approved external artifacts run sandboxed and cannot read the host document or gain ungranted capabilities", async ({ page }) => {
  await page.goto("/tests/e2e/host-harness.html?scenario=safe");
  const frame = page.locator("iframe[title='chess isolated game']");
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts");
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.locator(".playora-plugin-host__status")).toHaveText("Game connected in an isolated session.");
  await expect(page.getByTestId("capability-request-count")).toHaveText("0");

  const pluginFrame = page.frames().find(candidate => candidate.url().startsWith(ARTIFACT_ORIGIN));
  if (!pluginFrame) throw new Error("Browser did not create the isolated plugin frame");
  const parentReadable = await pluginFrame.evaluate(() => (
    window as unknown as { __playoraParentReadable?: boolean }
  ).__playoraParentReadable);
  expect(parentReadable).toBe(false);

  const initMessage = await pluginFrame.evaluate(() => (
    window as unknown as { __playoraInitMessage?: { sessionId: string; payload: Record<string, unknown> } }
  ).__playoraInitMessage);
  expect(initMessage?.sessionId).toMatch(/^[a-f0-9]{64}$/);
  expect(initMessage?.payload).toEqual({
    locale: "en",
    grantedCapabilities: ["locale:read", "session:lifecycle"],
  });
  expect(JSON.stringify(initMessage)).not.toMatch(/private-test-alias|service.role|access.?token|refresh.?token/i);
});

test("changing an immutable artifact version creates a fresh session nonce", async ({ page }) => {
  await page.goto("/tests/e2e/host-harness.html?scenario=replace");
  await expect(page.locator(".playora-plugin-host__status")).toHaveText("Game connected in an isolated session.");
  const initialFrame = page.frames().find(candidate => candidate.url().includes("/1.0.0/safe.html"));
  if (!initialFrame) throw new Error("Initial versioned artifact frame was not created");
  const oldSessionId = await initialFrame.evaluate(() => (
    window as unknown as { __playoraInitMessage?: { sessionId: string } }
  ).__playoraInitMessage?.sessionId);
  expect(oldSessionId).toMatch(/^[a-f0-9]{64}$/);

  await page.getByRole("button", { name: "Switch artifact version" }).click();
  const iframe = page.locator("iframe[title='chess isolated game']");
  await expect(iframe).toHaveAttribute("src", /1\.1\.0\/silent\.html/);
  await expect(page.locator(".playora-plugin-host__status")).toHaveText("Checking the isolated game session…");
  await expect.poll(() => page.frames().some(candidate => candidate.url().includes("/1.1.0/silent.html"))).toBe(true);
  const updatedFrame = page.frames().find(candidate => candidate.url().includes("/1.1.0/silent.html"));
  if (!updatedFrame) throw new Error("Updated versioned artifact frame was not created");
  const newSessionId = await updatedFrame.evaluate(() => (
    window as unknown as { __playoraInitMessage?: { sessionId: string } }
  ).__playoraInitMessage?.sessionId);
  expect(newSessionId).toMatch(/^[a-f0-9]{64}$/);
  expect(newSessionId).not.toBe(oldSessionId);
});

test("a second document load inside one session is stopped", async ({ page }) => {
  await page.goto("/tests/e2e/host-harness.html?scenario=navigate");
  await expect(page.locator(".playora-plugin-host__status")).toHaveText("Game connected in an isolated session.");
  await expect(page.locator(".playora-plugin-host__status")).toHaveText("The game navigated unexpectedly and was stopped.", { timeout: 7_500 });
  await expect(page.locator("iframe[title='chess isolated game']")).toHaveCount(0);
});

test("mobile Persian splash preserves RTL direction and horizontal fit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const shell = page.locator(".app-shell");
  await page.getByRole("button", { name: "Switch language to Persian" }).click();
  await expect(shell).toHaveAttribute("lang", "fa");
  await expect(shell).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "شروع کنید" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    screen: document.querySelector(".auth-welcome-screen")?.clientWidth ?? 0,
    screenScroll: document.querySelector(".auth-welcome-screen")?.scrollWidth ?? 0,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.screenScroll).toBeLessThanOrEqual(dimensions.screen + 1);

  await page.getByRole("button", { name: "شروع کنید" }).click();
  await expect(page.getByRole("dialog", { name: "ساخت حساب" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ادامه با گوگل" })).toBeVisible();
});

test("malformed plugin messages fail closed and keep the platform host recoverable", async ({ page }) => {
  await page.goto("/tests/e2e/host-harness.html?scenario=invalid");
  await expect(page.locator(".playora-plugin-host__status")).toHaveText("The game sent an invalid message and was stopped.");
  await expect(page.getByText("The Playora platform remains available.")).toBeVisible();
  await expect(page.locator("iframe[title='chess isolated game']")).toHaveCount(0);
  await expect(page.getByTestId("plugin-error-log")).toContainText("invalid_message");
});
