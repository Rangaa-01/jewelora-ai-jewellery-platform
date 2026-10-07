import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home page renders and backend health is reachable through the same origin", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const health = await request.get("/api/v1/health");
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toMatchObject({ status: "ok" });
  });
});
