import { expect, test, type Page } from "@playwright/test";

// Fake camera flags must be top-level (they force a dedicated worker).
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["camera"],
});

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("live try-on", () => {
  test("starts the camera, shows the overlay canvas and degrades honestly", async ({
    page,
    isMobile,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto("/try-on");
    await page.getByRole("tab", { name: "Live camera" }).click();
    await page.getByRole("button", { name: "Start camera" }).click();

    const video = page.getByLabel("Live camera preview");
    const overlay = page.getByTestId("live-overlay");
    const outcome = await Promise.race([
      page
        .getByRole("button", { name: "Capture" })
        .waitFor({ state: "visible", timeout: 90_000 })
        .then(() => "running"),
      page
        .getByText(
          /couldn't load the try-on models|isn't supported here|No camera available|access was blocked/,
        )
        .waitFor({ timeout: 90_000 })
        .then(() => "degraded"),
    ]);
    if (outcome === "running") {
      await expect(video).toBeVisible();
      await expect(overlay).toBeAttached();
      const playing = await video.evaluate(
        (el) =>
          (el as HTMLVideoElement).readyState >= 2 &&
          !(el as HTMLVideoElement).paused,
      );
      expect(playing).toBe(true);
      await expect(page.getByText(/fps/)).toBeVisible();
      await page.screenshot({
        path: `${process.env.SHOTS_DIR ?? "/tmp"}/live_${isMobile ? "mobile" : "desktop"}.png`,
        fullPage: false,
      });
      await page.getByRole("button", { name: "Stop" }).click();
      await expect(
        page.getByRole("button", { name: "Start camera" }),
      ).toBeVisible();
    } else {
      // Headless Chromium without GPU/WASM support reports the specific user-facing state.
      await expect(
        page
          .getByRole("button", { name: /Try again|Start camera/ })
          .or(page.getByText(/Upload a photo/)),
      ).toBeVisible();
    }
    expect(errors.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });
});
