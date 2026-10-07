import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * 3D viewer. The demo catalogue carries no 3D models (they come from the shop's CAD/scans),
 * so the spec uploads a small GLB fixture to a product through the admin API, verifies the
 * viewer, and removes the model again. Headless browsers may lack WebGL; the canvas
 * assertion degrades to an annotation while the chrome and network assertions always run.
 */
const PRODUCT_SLUG = "rose-cut-diamond-cluster-ring";
const GLB = readFileSync(join(__dirname, "..", "fixtures", "demo-ring.glb"));

async function staffContext(request: APIRequestContext): Promise<APIRequestContext> {
  const login = await request.post("/api/v1/auth/login", {
    headers: { "X-Requested-With": "jewelora" },
    data: { identifier: "manager@jewelora-demo.com", password: "Manager#12345" },
  });
  expect(login.ok(), "manager login").toBeTruthy();
  return request;
}

test.describe("3D jewellery viewer", () => {
  test("offers 3D only on demand, loads the GLB and keeps metal choice in sync", async ({ page, request }) => {
    const api = await staffContext(request);
    const product = await (await api.get(`/api/v1/products/${PRODUCT_SLUG}`)).json();
    const uploaded = await api.post(`/api/v1/admin/products/${product.id}/models`, {
      headers: { "X-Requested-With": "jewelora" },
      multipart: {
        file: { name: "demo-ring.glb", mimeType: "model/gltf-binary", buffer: GLB },
        meta: JSON.stringify({ scale: 1, is_primary: true }),
      },
    });
    expect(uploaded.status(), await uploaded.text()).toBe(201);
    const modelId = (await uploaded.json()).id as string;

    try {
      const glbResponses: number[] = [];
      page.on("response", (r) => {
        if (r.url().endsWith(".glb")) glbResponses.push(r.status());
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(`/products/${PRODUCT_SLUG}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Rose-cut");
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

      // Only metals that exist as variants are offered; with a single variant the switch is hidden
      // rather than implying other metals exist.
      await expect(viewer.getByRole("group", { name: "Metal colour" })).toHaveCount(0);
      await expect(viewer.getByRole("button", { name: "Rose Gold" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /White Gold · 18K/ })).toHaveAttribute("aria-pressed", "true");

      for (const name of ["Zoom in", "Zoom out", "Reset view", "Fullscreen"]) {
        await expect(viewer.getByRole("button", { name })).toBeVisible();
      }

      await page.getByRole("button", { name: "Photos" }).click();
      await expect(viewer).toHaveCount(0);
      await expect(page.getByRole("img", { name: /Rose-cut/ }).first()).toBeVisible();

      const hasCanvas = (await viewer.locator("canvas").count()) > 0;
      test.info().annotations.push({ type: "webgl", description: hasCanvas ? "canvas rendered" : "no WebGL in this browser" });
      expect(errors, "no uncaught JS errors").toEqual([]);
    } finally {
      await api.delete(`/api/v1/admin/products/${product.id}/models/${modelId}`, { headers: { "X-Requested-With": "jewelora" } });
    }
  });
});
