import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.testErrors = errors;
  await page.goto("/?preview=default");
});
test.afterEach(async ({ page }) => expect(page.testErrors).toEqual([]));

for (const fillHeight of [false, true]) {
  test(`one card keeps two horizontal months with fillHeight ${fillHeight}`, async ({ page }) => {
    await page.evaluate((fillHeight) => mountCard({ initialView: "multiMonthTwo", twoMonthLayout: "horizontal", fillHeight }), fillHeight);
    await expect(page.locator("fullcalendar-card")).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Calendars", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(1);
    const months = page.locator(".family-month");
    for (const [width, height] of [[1920, 1080], [1280, 720], [2560, 1440], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await expect(months).toHaveCount(2);
      await expect(page.locator(".family-day-header")).toHaveCount(14);
      await expect(page.locator(".family-week-number")).toHaveCount(12);
      await expect.poll(async () => {
        const [left, right] = await Promise.all([months.nth(0).boundingBox(), months.nth(1).boundingBox()]);
        return Math.abs(left.y - right.y) < 1 && left.x + left.width <= right.x + 1 &&
          right.x + right.width <= width + 1 && Math.abs(left.height - right.height) < 1 &&
          (!fillHeight || right.y + right.height <= height + 1);
      }).toBe(true);
      await expect(months.nth(0).locator(".family-month-header")).toHaveText("September 2026");
      await expect(months.nth(1).locator(".family-month-header")).toHaveText("October 2026");
    }
    // Width changes alone must not replace the chosen layout or reset navigation.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      document.querySelector("#container").style.cssText = "width:1100px;height:700px";
    });
    await expect.poll(async () => {
      const [left, right] = await Promise.all([months.nth(0).boundingBox(), months.nth(1).boundingBox()]);
      return Math.abs(left.y - right.y) < 1 && left.x + left.width <= right.x + 1 &&
        right.x + right.width <= 1101 && (!fillHeight || right.y + right.height <= 701);
    }).toBe(true);
    expect(await page.evaluate(() => card.calendar.view.type)).toBe("multiMonthTwo");
    await page.evaluate(() => { document.querySelector("#container").style.cssText = ""; });
    await page.locator("fullcalendar-card").screenshot({ path: `test-results/horizontal-months-${fillHeight ? "panel" : "normal"}-${test.info().project.name}.png` });
  });
}

test("shared month navigation moves both panes by one month, including New Year and Today", async ({ page }) => {
  await page.evaluate(() => mountCard({ initialView: "multiMonthTwo", twoMonthLayout: "horizontal", fillHeight: true }));
  const titles = page.locator(".family-month-header");
  await expect(titles).toHaveText(["September 2026", "October 2026"]);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(titles).toHaveText(["October 2026", "November 2026"]);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(titles).toHaveText(["September 2026", "October 2026"]);
  await page.evaluate(() => card.calendar.gotoDate("2026-12-15"));
  await expect(titles).toHaveText(["December 2026", "January 2027"]);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(titles).toHaveText(["January 2027", "February 2027"]);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  expect(await page.evaluate(() => {
    const today = new Date();
    const start = card.calendar.view.currentStart;
    const end = card.calendar.view.currentEnd;
    return start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth() &&
      end.getFullYear() * 12 + end.getMonth() - start.getFullYear() * 12 - start.getMonth() === 2;
  })).toBe(true);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("button", { name: "Two months", exact: true }).click();
  await expect(page.locator(".family-month-body-horizontal")).toHaveCount(2);
});

test("one calendar filter applies to both months and right-pane events open shared details", async ({ page }) => {
  await page.evaluate(async () => {
    eventData.push({ summary: "October appointment", start: { dateTime: "2026-10-15T14:30:00+02:00" }, end: { dateTime: "2026-10-15T16:00:00+02:00" } });
    await mountCard({ initialView: "multiMonthTwo", twoMonthLayout: "horizontal", fillHeight: true });
  });
  const months = page.locator(".family-month");
  await expect(months.nth(0).locator(".family-event").filter({ hasText: "Simskola" }).first()).toBeAttached();
  await expect(months.nth(1).locator(".family-event").filter({ hasText: "October appointment" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(page.locator(".family-event").filter({ hasText: /Simskola|October appointment/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(months.nth(0).locator(".family-event").filter({ hasText: "Simskola" }).first()).toBeAttached();
  await months.nth(1).locator(".family-event:visible").filter({ hasText: "October appointment" }).first().click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await expect(page.locator("dialog")).toContainText("October appointment");
  await expect(page.locator("dialog")).toContainText("14:30");
  await page.keyboard.press("Escape");
  await months.nth(0).getByRole("gridcell", { name: "September 25, 2026", exact: true }).locator(".family-more-link").click();
  await expect(page.locator(".family-overflow .family-event")).toHaveCount(32);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { card.hass = { ...card.hass, locale: { ...card.hass.locale, language: "sv" } }; });
  await expect(page.getByRole("button", { name: "Nästa", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Nästa", exact: true }).click();
  await expect(page.locator(".family-month-header")).toHaveText(["oktober 2026", "november 2026"]);
});
