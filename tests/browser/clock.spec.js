import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.testErrors = errors;
  await page.clock.install({ time: new Date("2026-09-15T12:30:05Z") });
  await page.clock.pauseAt(new Date("2026-09-15T12:30:05Z"));
  await page.goto("/?preview=default");
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("14:30:05");
});
test.afterEach(async ({ page }) => { expect(page.testErrors).toEqual([]); });

test("header clock follows real time in every view without replacing events or fetching data", async ({ page }) => {
  for (const view of ["dayGridDay", "dayGridWeek", "dayGridTwoWeeks", "dayGridMonth", "multiMonthTwo", "list"]) {
    await page.evaluate((view) => card.calendar.changeView(view), view);
    await expect(page.locator(".family-event").first()).toBeAttached();
    await page.evaluate(() => {
      window.clockEvent = card.renderRoot.querySelector(".family-event");
      window.clockApiCalls = 0;
      const callApi = card.hass.callApi;
      card.hass.callApi = (...args) => { clockApiCalls++; return callApi(...args); };
    });
    const before = await page.locator("header fullcalendar-clock time").textContent();
    await page.clock.fastForward(1000);
    await expect(page.locator("header fullcalendar-clock time")).not.toHaveText(before);
    expect(await page.evaluate(() => clockEvent.isConnected)).toBe(true);
    expect(await page.evaluate(() => clockApiCalls)).toBe(0);
    expect(await page.evaluate(() => card.calendar.view.type)).toBe(view);
  }
  await page.evaluate(() => card.calendar.gotoDate("2021-01-01"));
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("14:30:11");
});

test("header clock follows live language, hour12 and local/server time-zone preferences", async ({ page }) => {
  await page.evaluate(() => {
    card.hass = { ...card.hass, locale: { ...card.hass.locale, time_format: "12", time_zone: "server" },
      config: { ...card.hass.config, time_zone: "America/Los_Angeles" } };
  });
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("05:30:05 AM");
  await page.evaluate(() => {
    card.hass = { ...card.hass, locale: { ...card.hass.locale, language: "sv", time_format: "24" },
      config: { ...card.hass.config, time_zone: "Asia/Tokyo" } };
  });
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("21:30:05");
  await page.evaluate(() => {
    card.hass = { ...card.hass, locale: { ...card.hass.locale, time_zone: "local" } };
  });
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("14:30:05");
});

test("header clock stops on disconnect and resumes with current time on reconnect", async ({ page }) => {
  await page.evaluate(() => {
    window.headerClock = card.renderRoot.querySelector("fullcalendar-clock");
    window.clockTime = headerClock._now.getTime();
    card.remove();
  });
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => headerClock._now.getTime())).toBe(await page.evaluate(() => clockTime));
  await page.evaluate(async () => {
    document.querySelector("#container").append(card);
    await card.updateComplete;
  });
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("14:30:10");
  await page.clock.fastForward(1000);
  await expect(page.locator("header fullcalendar-clock time")).toHaveText("14:30:11");
});
