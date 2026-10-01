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
      await expect(page.locator(".family-week-number")).toHaveCount(10);
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

for (const [view, layout] of [["dayGridMonth", "vertical"], ["multiMonthTwo", "vertical"], ["multiMonthTwo", "horizontal"]]) {
  test(`${view} ${layout} only includes weeks containing days from its month`, async ({ page }) => {
    for (const firstDay of [0, 1]) {
      await page.evaluate(({ view, layout, firstDay }) => mountCard({ initialView: view, twoMonthLayout: layout, firstDay }), { view, layout, firstDay });
      for (const [date, counts, lastDates] of [
        ["2026-09-15", [35, 35], ["2026-10-03", "2026-10-04"]],
        ["2021-02-15", [35, 28], ["2021-03-06", "2021-02-28"]],
        ["2026-08-15", [42, 42], ["2026-09-05", "2026-09-06"]],
      ]) {
        await page.evaluate((date) => card.calendar.gotoDate(date), date);
        const grids = view === "dayGridMonth" ? page.locator("#calendar") : page.locator(".family-month");
        const days = grids.first().locator(".family-day-cell");
        await expect(days).toHaveCount(counts[firstDay]);
        await expect(days.last()).toHaveAttribute("data-date", lastDates[firstDay]);
        if (view === "multiMonthTwo") await expect(grids.nth(1).locator(".family-day-cell")).toHaveCount(35);
        // Partial boundary weeks remain, but no whole row belongs to another month.
        const rowsContainMonth = await grids.evaluateAll((elements, firstMonth) => elements.flatMap((element) => {
          const month = element.dataset.date || firstMonth;
          const dates = [...element.querySelectorAll(".family-day-cell")].map((cell) => cell.dataset.date);
          return Array.from({ length: dates.length / 7 }, (_, row) =>
            dates.slice(row * 7, row * 7 + 7).some((day) => day.startsWith(month)));
        }), date.slice(0, 7));
        expect(rowsContainMonth.every(Boolean)).toBe(true);
      }
    }
  });
}

async function expectCalendarFits(page) {
  await expect.poll(() => page.evaluate(() => {
    const root = card.shadowRoot;
    const calendar = root.querySelector(".calendar-container").getBoundingClientRect();
    const withinViewport = [card, root.querySelector("ha-card"), root.querySelector("#calendar")]
      .every((element) => element.getBoundingClientRect().bottom <= innerHeight + 1);
    const allDaysVisible = [...root.querySelectorAll(".family-day-cell")].every((element) => {
      const rect = element.getBoundingClientRect();
      const grid = element.closest(".family-month-body")?.getBoundingClientRect() || calendar;
      const label = element.querySelector(".family-day-top").getBoundingClientRect();
      return rect.top >= grid.top - 1 && rect.bottom <= grid.bottom + 1 && rect.height > 0 &&
        label.top >= rect.top - 1 && label.bottom <= rect.bottom + 1;
    });
    const scrollers = [...root.querySelectorAll("*")].filter((element) =>
      ["auto", "scroll"].includes(getComputedStyle(element).overflowY) &&
      element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1);
    return { withinViewport, allDaysVisible, scrollers: scrollers.length,
      pageFits: document.documentElement.scrollHeight <= innerHeight + 1 };
  })).toEqual({ withinViewport: true, allDaysVisible: true, scrollers: 0, pageFits: true });
}

for (const twoMonthLayout of ["horizontal", "vertical"]) {
  test(`full-height ${twoMonthLayout} months fit the screen below a header without scrolling`, async ({ page }) => {
    await page.evaluate((twoMonthLayout) => mountCard({ fillHeight: true, initialView: "multiMonthTwo", twoMonthLayout }), twoMonthLayout);
    await expectCalendarFits(page);
    // A header/padding change must be detected without a window resize. An
    // auto-height parent must also work, rather than requiring a fixed panel.
    await page.evaluate(() => { document.querySelector("#container").style.cssText = "height:auto;padding-top:64px"; });
    await expect.poll(() => page.locator("fullcalendar-card").evaluate((el) => el.getBoundingClientRect().top)).toBe(64);
    await expectCalendarFits(page);
    for (const [width, height] of [[1280, 720], [1024, 600], [390, 844], [1080, 1920]]) {
      await page.setViewportSize({ width, height });
      for (const date of ["2026-08-15", "2026-09-15"]) {
        await page.evaluate((date) => card.calendar.gotoDate(date), date);
        await expect(page.locator(".family-day-cell")).toHaveCount(date.includes("08") ? 77 : 70);
        await expectCalendarFits(page);
      }
      await page.locator(".family-month").first().getByRole("gridcell", { name: "September 25, 2026", exact: true }).locator(".family-more-link").click();
      await expect(page.locator(".family-overflow .family-event")).toHaveCount(32);
      await page.keyboard.press("Escape");
    }
    await page.locator(".family-month").first().getByRole("gridcell", { name: "September 25, 2026", exact: true }).locator(".family-more-link").click();
    await expect(page.locator(".family-overflow .family-event")).toHaveCount(32);
    await page.keyboard.press("Escape");
    // Other fitted grids share the viewport cap and keep their complete ranges.
    for (const [label, days] of [["Two weeks", 14], ["Month", 35]]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator(".family-day-cell")).toHaveCount(days);
      await expectCalendarFits(page);
    }
    await page.evaluate(() => { card.remove(); document.querySelector("#container").append(card); });
    await expectCalendarFits(page);
    await page.evaluate(() => { document.querySelector("#container").style.paddingTop = "96px"; });
    await expectCalendarFits(page);
    expect(await page.evaluate(() => card.calendar.view.type)).toBe("dayGridMonth");
  });
}
