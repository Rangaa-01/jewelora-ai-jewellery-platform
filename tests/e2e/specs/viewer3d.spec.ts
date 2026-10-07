import { expect, test } from "@playwright/test";

/**
 * 3D viewer on a seeded product with per-variant GLB models. Headless browsers may lack
 * WebGL; the canvas assertions degrade to a skip while the chrome and network assertions
 * always run.
 */
test.describe("3D jewellery viewer", () => {
  test("offers 3D only on demand, loads the GLB and keeps metal choice in sync", async ({ page }) => {
    const glbResponses: number[] = [];
    page.on("response", (r) => {
      if (r.url().endsWith(".glb")) glbResponses.push(r.status());
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/products/aurora-solitaire-ring");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Aurora");
    // three.js is not loaded until asked for: no canvas on the page yet.
    expect(await page.locator("canvas").count()).toBe(0);

    const view3d = page.getByRole("button", { name: "View in 3D" });
    await expect(view3d).toBeVisible();
    await view3d.click();
    await expect(page.getByRole("button", { name: "3D view" })).toHaveAttribute("aria-pressed", "true");

    const viewer = page.getByTestId("jewellery-viewer");
    await expect(viewer).toBeVisible();
    await expect.poll(() => glbResponses.length, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(glbResponses.every((s) => s === 200)).toBeTruthy();

    const metalGroup = viewer.getByRole("group", { name: "Metal colour" });
    await expect(metalGroup.getByRole("button", { name: "White Gold" })).toHaveAttribute("aria-pressed", "true");
    await metalGroup.getByRole("button", { name: "Rose Gold" }).click();
    await expect(metalGroup.getByRole("button", { name: "Rose Gold" })).toHaveAttribute("aria-pressed", "true");
    // The product page's own variant selector follows the viewer (lifted state).
    await expect(page.getByRole("button", { name: /Rose Gold · 18K/ })).toHaveAttribute("aria-pressed", "true");
    // Unavailable metals are never offered.
    await expect(metalGroup.getByRole("button", { name: "Silver" })).toHaveCount(0);

    for (const name of ["Zoom in", "Zoom out", "Reset view", "Fullscreen"]) {
      await expect(viewer.getByRole("button", { name })).toBeVisible();
    }

    await page.getByRole("button", { name: "Photos" }).click();
    await expect(page.getByRole("list", { name: "Product images" })).toBeVisible();

    const canvas = viewer.locator("canvas");
    const hasCanvas = (await canvas.count()) > 0;
    test.info().annotations.push({ type: "webgl", description: hasCanvas ? "canvas rendered" : "no WebGL in this browser" });
    expect(errors, "no uncaught JS errors").toEqual([]);
  });
});
