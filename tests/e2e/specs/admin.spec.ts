import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const FIXTURE = path.resolve(__dirname, "../../../ai/tests/fixtures/portrait_front.jpg");

async function login(page: Page, email: string, password: string, next = "/admin") {
  await page.goto(`/account/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email or phone").filter({ visible: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).filter({ visible: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith(next.split("?")[0]!));
}

test.describe("admin dashboard", () => {
  test("redirects anonymous visitors to the staff sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/account\/login\?next=%2Fadmin/);
  });

  test("manager can see KPIs, create a product, upload an image and work an enquiry", async ({ page, request, isMobile }) => {
    test.setTimeout(120_000);
    await login(page, "manager@jewelora-demo.com", "Manager#12345");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    const kpis = page.getByTestId("kpis");
    await expect(kpis).toBeVisible();
    await expect(kpis.getByText("Try-ons")).toBeVisible();
    await expect(kpis.getByText("Revenue (paid)")).toBeVisible();

    // Navigate to products through the role-aware nav.
    if (isMobile) await page.getByRole("button", { name: "Open admin menu" }).click();
    await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Products" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();

    // Create a product.
    await page.getByRole("link", { name: "New product" }).click();
    const sku = `E2E-${Date.now().toString(36).toUpperCase()}`;
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(`E2E Pearl Jhumka ${sku}`);
    await page.getByRole("textbox", { name: "SKU", exact: true }).fill(sku);
    await page.getByLabel("Category").selectOption({ label: "Earrings" });
    await page.getByLabel("Jewellery type").selectOption("earrings");
    await page.getByRole("textbox", { name: "Base price (₹)" }).fill("48500");
    await page.getByRole("spinbutton", { name: "Stock", exact: true }).fill("3");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]+\?tab=assets/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Pearl Jhumka");

    // Upload an image through the assets tab and verify it is listed.
    await page.getByLabel("Choose or drop a product photo").setInputFiles(FIXTURE);
    await page.getByLabel("Alt text").fill("E2E upload");
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("heading", { name: /Images \(1\)/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "E2E upload" })).toBeVisible();

    // Create an enquiry as a customer through the public API, then resolve it as staff.
    const enquiry = await request.post("/api/v1/enquiries", {
      headers: { "X-Requested-With": "jewelora" },
      data: { name: "E2E Customer", phone: "9876543210", message: `Is ${sku} available in 18K?` },
    });
    expect(enquiry.ok()).toBeTruthy();
    const reference: string = (await enquiry.json()).reference;

    await page.goto("/admin/enquiries");
    await page.getByRole("row", { name: new RegExp(reference) }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(`Is ${sku} available in 18K?`)).toBeVisible();
    await sheet.getByLabel("Status").selectOption("resolved");
    await expect(page.getByText("Enquiry updated")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Resolved" }).click();
    await expect(page.getByRole("row", { name: new RegExp(reference) })).toBeVisible();
  });

  test("sales staff only see the queues and get a clear access message elsewhere", async ({ page, isMobile }) => {
    await login(page, "sales@jewelora-demo.com", "Sales#12345");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    if (isMobile) await page.getByRole("button", { name: "Open admin menu" }).click();
    const nav = page.getByRole("navigation", { name: "Admin sections" }).first();
    await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Products" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Staff" })).toHaveCount(0);
    if (isMobile) await page.keyboard.press("Escape");

    await page.goto("/admin/products");
    await expect(page.getByRole("alert").filter({ hasText: /access/ })).toContainText(/don't have access to product management/i);
    await page.goto("/admin/staff");
    await expect(page.getByRole("alert").filter({ hasText: /access/ })).toContainText(/don't have access to staff management/i);
  });

  test("customers are told the dashboard is for staff", async ({ page, request }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const created = await request.post("/api/v1/auth/register", {
      headers: { "X-Requested-With": "jewelora" },
      data: { full_name: "E2E Shopper", email, password: "Secure#2024" },
    });
    expect(created.ok()).toBeTruthy();
    await login(page, email, "Secure#2024");
    await expect(page.getByRole("alert").filter({ hasText: /staff/i })).toContainText(/customer account/i);
  });
});
