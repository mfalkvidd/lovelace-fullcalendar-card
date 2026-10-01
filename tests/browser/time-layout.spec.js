import { test, expect } from "@playwright/test";

const views = ["dayGridDay", "dayGridWeek", "dayGridTwoWeeks", "dayGridMonth", "multiMonthTwo", "list"];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 3000 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.testErrors = errors;
  await page.goto("/?preview=default");
  await page.waitForSelector(".family-event");
});
test.afterEach(async ({ page }) => expect(page.testErrors).toEqual([]));

async function mountTimeFixture(page, config) {
  await page.evaluate(async ({ config, views }) => {
    eventData = [
      { summary: "All day", start: { date: "2026-09-15" }, end: { date: "2026-09-16" } },
      { summary: "Multi day", start: { dateTime: "2026-09-14T21:00:00+02:00" }, end: { dateTime: "2026-09-17T06:00:00+02:00" } },
      ...["05:00", "07:00", "12:30", "18:00", "22:00"].map((time) => ({
        summary: `At ${time}`, start: { dateTime: `2026-09-15T${time}:00+02:00` },
        end: { dateTime: `2026-09-15T${time.slice(0, 2)}:45:00+02:00` },
      })),
    ];
    await mountCard({ entities: [entities[0]], views, fillHeight: true, timeBasedLayout: true, ...config });
  }, { config, views });
}

async function placements(page) {
  return page.evaluate(() => {
    const root = card.shadowRoot;
    const elements = [...root.querySelectorAll(".family-event")].filter((el) => getComputedStyle(el).visibility !== "hidden" && !el.closest(".family-overflow"));
    const early = elements.find((el) => el.querySelector(".event-title")?.textContent === "At 05:00");
    if (!early) return null;
    const cell = early.closest(".family-day-cell, .family-list-day-body");
    const bounds = cell.getBoundingClientRect();
    const blocks = elements.map((el) => ({ title: el.querySelector(".event-title")?.textContent,
      ...Object.fromEntries(["top", "bottom", "height", "left", "right"].map((key) => [key, el.getBoundingClientRect()[key]])),
      band: el.querySelector(".event-title")?.dataset.timeBand,
    }));
    const top = blocks.filter((el) => el.band === "top" && el.left < bounds.right && el.right > bounds.left && el.top >= bounds.top && el.top < bounds.bottom);
    return { blocks: blocks.filter((el) => el.title?.startsWith("At ") && el.top >= bounds.top && el.top < bounds.bottom),
      topEnd: Math.max(...top.map((el) => el.bottom)), bottom: bounds.bottom };
  });
}

for (const [initialView, twoMonthLayout] of [...views.map((view) => [view, "vertical"]), ["multiMonthTwo", "horizontal"]]) {
  test(`${initialView} ${twoMonthLayout} places early/daytime/late events around the midpoint`, async ({ page }) => {
    await mountTimeFixture(page, { initialView, twoMonthLayout });
    await expect.poll(async () => {
      const result = await placements(page);
      if (!result || result.blocks.length !== 5) return false;
      const [early, morning, noon, evening, late] = result.blocks;
      return early.band === "early" && morning.band === "daytime" && noon.band === "daytime" && evening.band === "daytime" && late.band === "late" &&
        Math.abs(early.top - result.topEnd - 2) < 1 && Math.abs(late.bottom - result.bottom + 2) < 1 &&
        Math.abs((noon.top + noon.height / 2) - (early.bottom + late.top) / 2) < 1 &&
        result.blocks.every((event, index) => !index || event.top >= result.blocks[index - 1].bottom - 0.1);
    }).toBe(true);
    const late = page.locator(".family-event:visible").filter({ hasText: "At 22:00" }).first();
    await late.focus();
    await late.press("Enter");
    await expect(page.locator("dialog")).toContainText("At 22:00");
    await page.keyboard.press("Escape");
    if (initialView === "multiMonthTwo" && twoMonthLayout === "horizontal") {
      await page.locator("fullcalendar-card").screenshot({ path: `test-results/time-layout-${test.info().project.name}.png` });
    }
  });
}

for (const fillHeight of [false, true]) {
  test(`crowded days retain native overflow and details with fillHeight ${fillHeight}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const day = page.getByRole("gridcell", { name: "September 25, 2026", exact: true });
    await page.evaluate((fillHeight) => mountCard({ initialView: "dayGridTwoWeeks", fillHeight }), fillHeight);
    const originalCount = await day.locator(".family-event:visible").count();
    const originalLabel = await day.locator(".family-more-link").textContent();
    await page.evaluate((fillHeight) => mountCard({ initialView: "dayGridTwoWeeks", fillHeight, timeBasedLayout: true }), fillHeight);
    await expect(day.locator(".family-event:visible")).toHaveCount(originalCount);
    await expect(day.locator(".family-more-link")).toHaveText(originalLabel);
    await day.locator(".family-more-link").click();
    await expect(page.locator(".family-overflow .family-event")).toHaveCount(32);
    expect(await page.locator(".family-overflow .family-event").evaluateAll((events) => events.every((el) => !el.style.translate))).toBe(true);
    await page.locator(".family-overflow .family-event").filter({ hasText: "Busy 1-0" }).click();
    await expect(page.locator("dialog")).toContainText("Busy 1-0");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });
}

test("resizing, navigation, filters, timezone changes and reconnect refresh positions", async ({ page }) => {
  await mountTimeFixture(page, { initialView: "dayGridWeek" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect.poll(async () => {
    const result = await placements(page);
    return result && Math.abs(result.blocks.at(-1).bottom - result.bottom + 2) < 1;
  }).toBe(true);
  await page.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(page.locator(".family-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(page.locator(".family-event").filter({ hasText: "At 22:00" })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.evaluate(() => { card.remove(); document.querySelector("#container").append(card); });
  await expect.poll(async () => (await placements(page))?.blocks.length).toBe(5);
  await page.evaluate(() => {
    card.hass = { ...card.hass, config: { time_zone: "America/Los_Angeles" }, locale: { ...card.hass.locale, time_zone: "server" } };
  });
  const lateTitle = page.locator(".family-event .event-title").filter({ hasText: "At 22:00" });
  await expect(lateTitle).toHaveAttribute("data-time-band", "daytime");
  await expect(lateTitle).toHaveAttribute("data-start-minute", "780");
  await page.evaluate(() => card.calendar.getEvents().find((event) => event.title === "At 22:00").setAllDay(true));
  await expect(lateTitle).toHaveAttribute("data-time-band", "top");
  await expect.poll(() => lateTitle.evaluate((el) => el.closest(".family-event").style.translate)).toBe("");
  await page.evaluate(() => card.setConfig({ entities: [entities[0]], views: ["dayGridWeek"], timeBasedLayout: false, fillHeight: true }));
  await expect(page.locator("fullcalendar-card")).not.toHaveAttribute("time-based-layout");
  expect(await page.locator(".family-event").evaluateAll((events) => events.every((el) => !el.style.translate))).toBe(true);
});

async function expectAfternoonSpacing(page) {
  await expect.poll(() => page.evaluate(() => {
    const day = card.shadowRoot.querySelector('.family-day-cell[data-date="2026-09-15"]');
    const events = [...day.querySelectorAll('.family-event')].filter((el) => getComputedStyle(el).visibility !== 'hidden');
    const allDay = events.find((el) => el.textContent.includes('Förskolan stängd'));
    const timed = events.filter((el) => el.querySelector('.event-time'));
    if (!allDay || timed.length !== 4) return false;
    const bounds = timed.map((el) => el.getBoundingClientRect());
    const scale = day.getBoundingClientRect().height / parseFloat(getComputedStyle(day).height);
    const top = allDay.getBoundingClientRect().bottom + 2 * scale;
    const bottom = day.getBoundingClientRect().bottom - 2 * scale;
    const target = top + (14.5 - 7) / 11 * (bottom - top);
    const center = bounds.reduce((sum, rect) => sum + rect.top + rect.height / 2, 0) / bounds.length;
    return Math.abs(center - target) < 2 && bounds[0].top > top + 30 &&
      bounds.every((rect, index) => rect.bottom <= bottom + 1 && (!index || rect.top >= bounds[index - 1].bottom));
  })).toBe(true);
}

test('four simultaneous afternoon events stay below the midpoint through scaling and native style updates', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 854 });
  await page.evaluate(() => mountCard({ initialView: 'dayGridWeek', fillHeight: true, timeBasedLayout: true }));
  await expectAfternoonSpacing(page);
  await page.evaluate(() => { document.body.style.zoom = '1.25'; });
  await expectAfternoonSpacing(page);
  await expect.poll(() => page.locator('fullcalendar-card').evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
  // Native rerenders can replace an event's inline style without remounting it.
  await page.evaluate(() => {
    for (const el of card.shadowRoot.querySelectorAll('.family-event')) el.style.removeProperty('translate');
  });
  await expectAfternoonSpacing(page);
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await expectAfternoonSpacing(page);
});

test('the main preview enables time-based spacing after selecting Week', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await expect(page.locator('fullcalendar-card')).toHaveAttribute('time-based-layout');
  await expectAfternoonSpacing(page);
});
