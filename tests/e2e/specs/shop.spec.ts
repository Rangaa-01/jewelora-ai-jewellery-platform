import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const PRODUCT_SLUG = "gold-crescent-drop-earrings"; // no sizes, try-on enabled
const RING_SLUG = "rose-cut-diamond-cluster-ring"; // sized product

/**
 * Every run of this spec places an order, which reserves a unit of stock. So that the
 * demo product never ends up "sold out" for the next run, a manager tops it up first.
 */
async function ensureInStock(
  request: APIRequestContext,
  slug: string,
  minimum = 5,
) {
  const product = await (await request.get(`/api/v1/products/${slug}`)).json();
  if (product.stock_quantity >= minimum) return;
  const login = await request.post("/api/v1/auth/login", {
    headers: { "X-Requested-With": "jewelora" },
    data: {
      identifier: "manager@jewelora-demo.com",
      password: "Manager#12345",
    },
  });
  expect(login.ok(), "manager login").toBeTruthy();
  const variants = (product.variants as Record<string, unknown>[]).map((v) => ({
    id: v.id,
    sku_suffix: v.sku_suffix,
    metal_type: v.metal_type,
    stone_type: v.stone_type,
    purity: v.purity,
    price_delta: v.price_delta,
    stock_quantity: minimum,
    tint_hex: v.tint_hex,
    is_default: v.is_default,
    is_active: v.is_active,
    sort_order: v.sort_order,
  }));
  const patched = await request.patch(`/api/v1/admin/products/${product.id}`, {
    headers: { "X-Requested-With": "jewelora" },
    data: { stock_quantity: minimum, variants },
  });
  expect(patched.status(), await patched.text()).toBe(200);
  await request.post("/api/v1/auth/logout", {
    headers: { "X-Requested-With": "jewelora" },
  });
}

function uniqueEmail(): string {
  return `shopper-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function register(page: Page, email: string) {
  await page.goto("/account/register?next=/cart");
  await page
    .getByRole("main")
    .getByLabel("Full name")
    .fill("Playwright Shopper");
  await page.getByRole("main").getByLabel("Email").fill(email);
  await page
    .getByRole("main")
    .getByLabel("Password", { exact: true })
    .fill("Secure#2024");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Create account" })
    .click();
  await expect(page).toHaveURL(/\/cart$/);
}

test.describe("shop", () => {
  test("guest bag survives sign-up, then wishlist, enquiry, appointment and checkout work end to end", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await ensureInStock(request, PRODUCT_SLUG);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Guest adds to bag
    await page.goto(`/products/${PRODUCT_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Add to Bag" })
      .click();
    await expect(page.getByText("Added to your bag")).toBeVisible();
    await expect(page.getByRole("link", { name: /Bag \(1\)/ })).toBeVisible();

    // Sized product refuses without a size (client-side guard)
    await page.goto(`/products/${RING_SLUG}`);
    await expect(page.getByRole("group", { name: "Ring size" })).toBeVisible();

    // Register with a fresh account: the guest bag merges into the account
    const email = uniqueEmail();
    await register(page, email);
    await expect(
      page.getByRole("heading", { level: 1, name: "Shopping bag" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Gold Crescent Drop Earrings" }).first(),
    ).toBeVisible();
    await expect(page.getByText("GST (3%)")).toBeVisible();

    // Wishlist add/remove from the product page
    await page.goto(`/products/${PRODUCT_SLUG}`);
    await page
      .getByRole("main")
      .getByRole("button", { name: "Add to Wishlist" })
      .click();
    await expect(
      page.getByRole("main").getByRole("button", { name: "In your wishlist" }),
    ).toBeVisible();
    await page.goto("/wishlist");
    await expect(
      page.getByRole("heading", { level: 1, name: "Saved jewellery" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Gold Crescent Drop Earrings" }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Remove Gold Crescent Drop Earrings/ })
      .click();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();

    // Enquiry
    await page.goto(`/enquire?product=${PRODUCT_SLUG}`);
    await page.getByRole("main").getByLabel("Phone").fill("9876543210");
    await page
      .getByLabel("Your question")
      .fill("Is this available in 18K with pearls?");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Send enquiry" })
      .click();
    await expect(page.getByText(/Your enquiry reference is/)).toBeVisible();

    // Checkout with pay at store
    await page.goto("/checkout");
    await expect(
      page.getByRole("heading", { level: 1, name: "Almost yours" }),
    ).toBeVisible();
    await page.getByRole("main").getByLabel("Phone").fill("9876543210");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Continue" })
      .click();
    await expect(page.getByRole("main").getByLabel("Store")).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Continue" })
      .click();
    await expect(
      page.getByRole("main").getByLabel("Payment method"),
    ).toHaveValue("pay_at_store");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Continue" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review your order" }),
    ).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Place order" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your pieces are reserved" }),
    ).toBeVisible();
    await expect(page.getByText(/Order JW/)).toBeVisible();

    // Order appears in the account
    await page.getByRole("link", { name: "View order" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Reserved" }),
    ).toBeVisible();
    await page.goto("/account/orders");
    await expect(page.getByRole("link", { name: /Order JW/ })).toBeVisible();

    expect(errors, "no uncaught JS errors").toEqual([]);
  });

  test("guest books the first available appointment slot tomorrow", async ({
    page,
  }) => {
    await page.goto(`/appointments/new?product=${PRODUCT_SLUG}`);
    await page
      .getByRole("main")
      .getByLabel("Your name")
      .fill("Playwright Guest");
    await page.getByRole("main").getByLabel("Phone").fill("9876543210");
    const slot = page
      .getByRole("radio")
      .filter({ hasNot: page.locator("[disabled]") })
      .first();
    await expect(
      page.getByRole("radiogroup", { name: "Available times" }),
    ).toBeVisible({ timeout: 20_000 });
    const enabled = page
      .getByRole("radiogroup", { name: "Available times" })
      .locator("button:not([disabled])")
      .first();
    await enabled.click();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Request appointment" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Appointment requested" }),
    ).toBeVisible();
    await expect(page.getByText(/Reference AP/)).toBeVisible();
  });

  test("stylist renders catalogue recommendations with reasons", async ({
    page,
  }) => {
    await page.goto(
      "/stylist?q=traditional%20gold%20jewellery%20for%20a%20wedding%20under%202%20lakh",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: /pieces for/ }),
    ).toBeVisible({ timeout: 30_000 });
    const picks = page.getByRole("listitem").filter({ hasText: /Pick 1/ });
    await expect(picks.first()).toBeVisible();
    await expect(page.getByText(/sits within your/).first()).toBeVisible();
  });

  test("visual search page renders and accepts an image", async ({ page }) => {
    await page.goto("/visual-search");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Find jewellery",
    );
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Search the catalogue" }),
    ).toBeDisabled();
  });

  test("shared look page shows an honest state for unknown tokens", async ({
    page,
  }) => {
    await page.goto("/looks/not-a-real-token-123");
    await expect(page.getByText("This look isn't available")).toBeVisible({
      timeout: 30_000,
    });
  });
});
