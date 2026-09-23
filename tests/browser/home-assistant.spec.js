import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.skip(!process.env.HA_URL, "Set HA_URL after preparing a disposable Home Assistant instance (see tests/README.md).");

async function revealEvent(card, title = "Simskola") {
  await expect(card.locator(".family-event").filter({ hasText: title }).first()).toBeAttached();
  const event = card.locator(".family-event:visible").filter({ hasText: title }).first();
  if (!(await event.count())) {
    await card.getByRole("gridcell", { name: "September 15, 2026", exact: true }).first().locator(".family-more-link:visible").click();
  }
  await expect(event).toBeVisible();
  return event;
}

test("Home Assistant 2026.1 panel integration", async ({ page }) => {
  test.setTimeout(60000);
  const auth = JSON.parse(await readFile(".test-ha/auth.json", "utf8"));
  await page.addInitScript((token) => {
    localStorage.setItem("hassTokens", JSON.stringify(token));
  }, auth);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${process.env.HA_URL}/lovelace/calendar`);
  const card = page.locator("fullcalendar-card");
  await expect(card).toBeVisible();
  await card.evaluate(async (element) => {
    await element.updateComplete;
    element.calendar.gotoDate("2026-09-15");
  });
  expect(await card.evaluate((element) => element.hass.config.version)).toMatch(/^2026\.1\./);
  await expect(card.locator("ha-button").filter({ hasText: "Today" })).toBeVisible();
  expect(await card.locator("ha-icon-button").first().evaluate((button) => button.path)).toBeTruthy();
  const bounds = await card.boundingBox();
  expect(Math.abs(bounds.y + bounds.height - page.viewportSize().height)).toBeLessThan(5);
  await expect(await revealEvent(card)).toContainText(/14:30\s*–\s*16:00/);
  await page.keyboard.press("Escape");

  const calendarControls = card.getByRole("group", { name: "Calendars", exact: true });
  await expect(calendarControls.getByRole("button", { pressed: true })).toHaveCount(4);
  await calendarControls.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(calendarControls.getByRole("button", { name: "Person 1", exact: true, pressed: false })).toBeVisible();
  await expect(card.locator(".family-event").filter({ hasText: "Simskola" })).toHaveCount(0);
  await expect(card.locator(".family-event").filter({ hasText: "Person 2 appointment" }).first()).toBeAttached();
  await calendarControls.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(calendarControls.getByRole("button", { name: "Person 1", exact: true, pressed: true })).toBeVisible();
  await expect(await revealEvent(card)).toContainText("Simskola");
  await page.keyboard.press("Escape");

  for (const [label, view, days, months] of [
    ["Day", "dayGridDay", 1, 0], ["Week", "dayGridWeek", 7, 0],
    ["Two weeks", "dayGridTwoWeeks", 14, 0],
    ["Month", "dayGridMonth", 0, 1], ["Two months", "multiMonthTwo", 0, 2],
  ]) {
    await card.getByRole("button", { name: label, exact: true }).click();
    await card.evaluate((element) => element.calendar.gotoDate("2026-09-15"));
    expect(await card.evaluate((element) => element.calendar.view.type)).toBe(view);
    const expected = await card.evaluate((element, { days, months }) => {
      const date = new Date(element.calendar.view.currentStart);
      if (months) date.setMonth(date.getMonth() + months);
      else date.setDate(date.getDate() + days);
      return date.toISOString();
    }, { days, months });
    await card.getByRole("button", { name: "Next", exact: true }).click();
    expect(await card.evaluate((element) => element.calendar.view.currentStart.toISOString())).toBe(expected);
    await card.getByRole("button", { name: "Previous", exact: true }).click();
    await card.evaluate((element) => element.calendar.gotoDate("2026-09-15"));
    await (await revealEvent(card)).click();
    await expect(card.locator("dialog")).toBeVisible();
    await expect(card.locator("dialog")).toContainText("14:30");
    await expect(card.locator("dialog")).toContainText("16:00");
    await expect(card.locator("dialog")).toContainText("Person 1");
    await card.locator("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.keyboard.press("Escape");
    await card.getByRole("button", { name: "Today", exact: true }).click();
    expect(await card.evaluate((element) => element.calendar.view.activeStart <= new Date() && element.calendar.view.activeEnd > new Date())).toBe(true);
  }
  await card.getByRole("button", { name: "Week", exact: true }).click();
  await page.setViewportSize({ width: 600, height: 1000 });
  await expect(card.locator(".family-day-header")).toHaveCount(7);
  expect(await card.evaluate((element) => element.calendar.view.type)).toBe("dayGridWeek");
  await page.setViewportSize({ width: 1080, height: 1920 });
  await card.getByRole("button", { name: "Month", exact: true }).click();
  await card.evaluate((element) => element.calendar.gotoDate("2026-09-15"));
  await expect(await revealEvent(card)).toContainText("Simskola");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `test-results/ha-month-${test.info().project.name}.png` });
  await card.getByRole("button", { name: "Two months", exact: true }).click();
  await expect(card.locator(".family-month")).toHaveCount(2);
  await expect(card.locator(".family-month-header").nth(0)).toContainText("September 2026");
  await expect(card.locator(".family-month-header").nth(1)).toContainText("October 2026");
  await page.screenshot({ path: `test-results/ha-panel-${test.info().project.name}.png` });
  await expect(card.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Home Assistant normal card, legacy YAML, and explicit preferences", async ({ page }) => {
  const auth = JSON.parse(await readFile(".test-ha/auth.json", "utf8"));
  await page.addInitScript((token) => localStorage.setItem("hassTokens", JSON.stringify(token)), auth);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.HA_URL}/lovelace/normal`);
  const card = page.locator("fullcalendar-card");
  await expect(card).toBeVisible();
  await card.evaluate(async (element) => {
    await element.updateComplete;
    element.calendar.gotoDate("2026-09-15");
  });
  await expect(card.getByRole("button", { name: "Day", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Week", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Month", exact: true })).toBeVisible();
  expect((await card.boundingBox()).width).toBeLessThan(650);
  await expect(await revealEvent(card)).toContainText("Simskola");
  await page.keyboard.press("Escape");
  for (const firstDay of [0, 1]) {
    await card.evaluate(async (element, firstDay) => {
      element.setConfig({ entities: [{ entity: "calendar.person_1", eventColor: "green" }], firstDay, hour12: false, initialView: "dayGridWeek" });
      await element.updateComplete;
      element.calendar.gotoDate("2026-09-15");
    }, firstDay);
    await expect(card.locator(".family-day-header")).toHaveCount(7);
    await expect(card.locator(".family-day-header").first()).toHaveAttribute("aria-label", firstDay ? "September 14, 2026" : "September 13, 2026");
    await expect(await revealEvent(card)).toContainText(/14:30\s*–\s*16:00/);
    await page.keyboard.press("Escape");
  }
  await page.screenshot({ path: `test-results/ha-normal-${test.info().project.name}.png` });
  await card.evaluate((element) => {
    element.hass = { ...element.hass, locale: { ...element.hass.locale, language: "sv" } };
  });
  await expect(card.getByRole("button", { name: "Idag", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Vecka", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Nästa", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Förra", exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Dag", exact: true }).click();
  await card.evaluate((element) => element.calendar.gotoDate("2026-09-15"));
  await card.locator(".family-event:visible").filter({ hasText: "Simskola" }).first().click();
  await expect(card.locator("dialog .event-dates")).toContainText("tisdag 15 september 2026");
  await card.getByRole("button", { name: "Stäng", exact: true }).click();
  await expect(card.locator("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
