import { expect, test, type Page } from "@playwright/test";

const NAV = [
  { label: "Collections", href: "/collections" },
  { label: "Try On", href: "/try-on" },
  { label: "Bridal", href: "/bridal" },
  { label: "AI Stylist", href: "/stylist" },
  { label: "Visual Search", href: "/visual-search" },
  { label: "Book a Visit", href: "/appointments/new" },
];

async function expectNoPageErrors(page: Page, run: () => Promise<void>) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await run();
  expect(errors, "no uncaught JS errors").toEqual([]);
}

test.describe("smoke", () => {
  test("home renders the hero and the backend is reachable through the same origin", async ({ page, request }) => {
    await expectNoPageErrors(page, async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/Try jewellery/i);
      await expect(page.getByRole("link", { name: "Try It On" }).first()).toHaveAttribute("href", "/try-on");
      await expect(page.getByRole("link", { name: "Explore Collection" })).toHaveAttribute("href", "/collections");
    });
    const health = await request.get("/api/v1/health");
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toMatchObject({ status: "ok" });
  });

  for (const item of NAV) {
    test(`primary nav: ${item.label} leads to a page with a heading`, async ({ page, isMobile }) => {
      await page.goto("/");
      if (isMobile) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: item.label }).click();
      } else {
        await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: item.label }).click();
      }
      await expect(page).toHaveURL(new RegExp(`${item.href.replace("/", "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("mobile menu opens and closes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "All Jewellery" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("catalogue page renders a grid or an honest empty state", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1, name: "All Jewellery" })).toBeVisible();
    await expect(page.getByRole("article").first().or(page.getByText(/No jewellery matches yet/))).toBeVisible();
  });

  test("unknown product shows a friendly not-found state, never a raw error", async ({ page }) => {
    await page.goto("/products/this-piece-does-not-exist");
    await expect(page.getByRole("alert").filter({ hasText: /isn.t available|couldn.t load/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/TypeError|undefined|Traceback/);
  });

  test("login form validates before submitting", async ({ page }) => {
    await page.goto("/account/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").first()).toContainText(/email or phone/i);
  });
});
