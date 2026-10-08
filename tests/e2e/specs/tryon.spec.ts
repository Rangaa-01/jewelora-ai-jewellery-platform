import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const FIXTURES = resolve(__dirname, "../../../ai/tests/fixtures");

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function pickProduct(page: Page, name: string) {
  const search = page.getByRole("searchbox", {
    name: "Search try-on jewellery",
  });
  await search.fill(name);
  const button = page.getByRole("button", { name }).first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
  await expect(
    page.getByRole("region", { name: /Your look/ }).getByText(name),
  ).toBeVisible();
}

test.describe("photo try-on", () => {
  test("fits a necklace onto a portrait and fine-tunes the placement", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto("/try-on");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /See it on you/,
    );
    await pickProduct(page, "Pearl Lattice Choker");

    await page
      .getByLabel(/Upload your photo/)
      .setInputFiles(resolve(FIXTURES, "portrait_front.jpg"));
    await page.getByRole("button", { name: "Try It On" }).click();

    const result = page.getByRole("img", { name: "Your try-on result" });
    await expect(result).toBeVisible({ timeout: 60_000 });
    const src = await result.getAttribute("src");
    expect(src).toMatch(/\/api\/v1\/media\/private\//);
    const image = await page.request.get(src!);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/webp");

    await page.getByRole("button", { name: "Fine-tune the fit" }).click();
    const slider = page.getByRole("slider", { name: "Size" });
    await expect(slider).toBeVisible();
    await slider.fill("1.4");
    await expect(page.getByText("Updating fit…")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Updating fit…")).toBeHidden({
      timeout: 60_000,
    });
    const after = await page
      .getByRole("img", { name: "Your try-on result" })
      .getAttribute("src");
    expect(after).not.toBe(src);
    await expect(
      page.getByRole("button", { name: "Hold to compare" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("shows a friendly message when the photo has no face", async ({
    page,
  }) => {
    await page.goto("/try-on");
    await pickProduct(page, "Pearl Lattice Choker");
    await page
      .getByLabel(/Upload your photo/)
      .setInputFiles(resolve(FIXTURES, "hand_single.jpg"));
    await page.getByRole("button", { name: "Try It On" }).click();
    const alert = page.getByRole("alert").filter({ hasText: /./ });
    await expect(alert).toBeVisible({ timeout: 60_000 });
    await expect(alert).toContainText(/couldn't find a face/i);
    await expect(alert).not.toContainText(/Traceback|Error:/);
  });
});
