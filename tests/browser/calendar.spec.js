import { test, expect } from "@playwright/test";

async function visibleEvent(page, title = "Simskola") {
  const event = page.locator(".family-event:visible").filter({ hasText: title }).first();
  if (!(await event.count())) {
    await page.getByRole("gridcell", { name: "September 15, 2026", exact: true }).first().locator(".family-more-link:visible").click();
  }
  return event;
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.testErrors = errors;
  await page.goto("/");
  await expect(page.locator(".family-event").first()).toBeVisible();
});
test.afterEach(async ({ page }) => { expect(page.testErrors).toEqual([]); });

test("navigation, fixed view selection, and readable events", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "September 2026" })).toBeVisible();
  await expect(page.locator(".family-event").filter({ hasText: "Simskola" }).first()).toContainText(/14:30\s*–\s*16:00/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("button", { name: "Week", exact: true }).click();
  expect(await page.evaluate(() => card.calendar.view.type)).toBe("dayGridWeek");
  await expect(page.locator(".family-day-header")).toHaveCount(7);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".family-day-header")).toHaveCount(7);
  expect(await page.evaluate(() => card.calendar.view.type)).toBe("dayGridWeek");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.locator(".family-event .event-title").filter({ hasText: "Simskola" }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/portrait-month.png" });
});

for (const [view, label, days, months] of [
  ["dayGridDay", "Day", 1, 0], ["dayGridWeek", "Week", 7, 0],
  ["dayGridTwoWeeks", "Two weeks", 14, 0],
  ["dayGridMonth", "Month", 0, 1], ["multiMonthTwo", "Two months", 0, 2],
]) {
  test(`${label}: navigation interval, initialView and readable narrow times`, async ({ page }) => {
    await page.evaluate((initialView) => mountCard({ initialView, firstDay: 1 }), view);
    const original = await page.evaluate(() => card.calendar.view.currentStart.toISOString());
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const next = await page.evaluate(() => card.calendar.view.currentStart.toISOString());
    const expected = await page.evaluate(({ original, months, days }) => {
      const date = new Date(original);
      if (months) date.setMonth(date.getMonth() + months);
      else date.setDate(date.getDate() + days);
      return date.toISOString();
    }, { original, months, days });
    expect(next).toBe(expected);
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    expect(await page.evaluate(() => card.calendar.view.currentStart.toISOString())).toBe(original);
    await page.evaluate(() => card.calendar.gotoDate("2026-09-15"));
    await page.setViewportSize({ width: 390, height: 844 });
    const event = await visibleEvent(page);
    await expect(event.locator(".event-time")).toBeVisible();
    await expect(event.locator(".event-time")).toContainText(/14:30\s*–\s*16:00/);
    expect(await page.evaluate(() => card.calendar.view.type)).toBe(view);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Today", exact: true }).click();
    expect(await page.evaluate(() => {
      const view = card.calendar.view;
      return view.activeStart <= new Date() && view.activeEnd > new Date();
    })).toBe(true);
  });
}

test("two complete months are stacked and retain independent weekday grids", async ({ page }) => {
  await page.evaluate(() => mountCard({ initialView: "multiMonthTwo", firstDay: 1 }));
  const months = page.locator(".family-month");
  await expect(months).toHaveCount(2);
  await expect(page.locator(".family-month-header").nth(0)).toContainText("September 2026");
  await expect(page.locator(".family-month-header").nth(1)).toContainText("October 2026");
  const [first, second] = await Promise.all([months.nth(0).boundingBox(), months.nth(1).boundingBox()]);
  expect(second.y).toBeGreaterThan(first.y);
  expect(second.x).toBe(first.x);
  await expect(page.locator(".family-day-header")).toHaveCount(14);
});

for (const [firstDay, expected] of [[0, 0], [1, 1], ["auto", 2]]) {
  test(`firstDay ${firstDay} applies in week, two-week, month and two-month views`, async ({ page }) => {
    await page.evaluate((firstDay) => mountCard({ firstDay }, { first_weekday: "tuesday" }), firstDay);
    for (const label of ["Week", "Two weeks", "Month", "Two months"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      expect(await page.evaluate(() => card.calendar.getOption("firstDay"))).toBe(expected);
      const firstText = await page.locator(".family-day-header").first().textContent();
      expect(firstText).toMatch([/Sun/, /Mon/, /Tue/][expected]);
      if (label === "Two weeks") {
        await expect(page.locator(".family-day-cell")).toHaveCount(14);
        expect(await page.evaluate(() => card.calendar.view.currentStart.getDay())).toBe(expected);
      }
    }
  });
}

for (const [hour12, preference, expected] of [["auto", "24", /14:30/], ["auto", "12", /0?2:30.*PM/i], [false, "12", /14:30/], [true, "24", /0?2:30.*PM/i]]) {
  test(`hour12 ${hour12} with HA ${preference} is consistent in every view and details`, async ({ page }) => {
    await page.evaluate(({ hour12, preference }) => mountCard({ hour12 }, { time_format: preference }), { hour12, preference });
    for (const label of ["Day", "Week", "Two weeks", "Month", "Two months"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.evaluate(() => card.calendar.gotoDate("2026-09-15"));
      const event = await visibleEvent(page);
      await expect(event.locator(".event-time")).toHaveText(expected);
      await event.click();
      await expect(page.locator("dialog .event-dates")).toContainText(expected);
      await expect(page.locator("dialog")).toContainText("Person 1");
      await expect(page.locator("dialog")).toContainText("Bring a towel");
      await expect(page.locator("dialog")).toContainText("Pool");
      await page.locator("dialog").getByRole("button", { name: "Close", exact: true }).click();
      await page.keyboard.press("Escape");
    }
  });
}

test("all-day, multi-day, four colors, overflow and safe details", async ({ page }) => {
  const allDay = page.locator(".family-event").filter({ hasText: "Förskolan stängd" }).first();
  await expect(allDay.locator(".event-time")).toHaveCount(0);
  await allDay.click();
  await expect(page.locator("dialog .event-dates")).toContainText("September 15, 2026");
  await expect(page.locator("dialog .event-dates")).not.toContainText("September 16");
  await page.keyboard.press("Escape");
  await page.locator(".family-event").filter({ hasText: "Holiday" }).first().click();
  await expect(page.locator("dialog .event-dates")).toContainText("September 19, 2026");
  await expect(page.locator("dialog .event-dates")).not.toContainText("September 20");
  await page.keyboard.press("Escape");
  const colors = [];
  for (const title of ["Simskola", "Person 2 appointment", "Person 3 appointment", "Person 4 appointment"]) {
    colors.push(await page.locator(".family-event").filter({ hasText: title }).first().evaluate((el) => getComputedStyle(el).backgroundColor));
  }
  expect(new Set(colors).size).toBe(4);
  await page.locator(".family-more-link").last().click();
  await expect(page.locator(".family-overflow .family-event")).toHaveCount(32);
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    card.calendar.addEvent({ title: '<img src=x onerror="window.injected=true">', start: "2026-09-10", description: '<b>plain text</b>' });
  });
  await page.locator(".family-event").filter({ hasText: "<img" }).click();
  await expect(page.locator("dialog img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("displayEventEnd false retains start time and complete details", async ({ page }) => {
  await page.evaluate(() => mountCard({ displayEventEnd: false }));
  const event = await visibleEvent(page);
  await expect(event.locator(".event-time")).toHaveText(/14:30/);
  await expect(event.locator(".event-time")).not.toContainText("16:00");
  await event.click();
  await expect(page.locator("dialog .event-dates")).toContainText("16:00");
});

test("container-only resizing fills available height without changing views", async ({ page }) => {
  await page.evaluate(() => mountCard({ fillHeight: true, initialView: "dayGridWeek" }));
  const calendar = page.locator("#calendar");
  const initial = await calendar.boundingBox();
  await page.evaluate(() => Object.assign(document.querySelector("#container").style, { width: "600px", height: "1000px" }));
  await expect.poll(async () => (await calendar.boundingBox()).height).toBeGreaterThan(initial.height + 150);
  await expect.poll(async () => (await calendar.boundingBox()).width).toBeLessThan(initial.width);
  await expect(page.locator(".family-day-header")).toHaveCount(7);
  expect(await page.evaluate(() => card.calendar.view.type)).toBe("dayGridWeek");
  const headings = await page.locator(".family-day-header").all();
  const bounds = await Promise.all(headings.map((heading) => heading.boundingBox()));
  expect(bounds.at(-1).x + bounds.at(-1).width - bounds[0].x).toBeLessThan(600);
  await page.screenshot({ path: `test-results/container-week-${test.info().project.name}.png` });
});

test("live preferences, reconnect, stale event removal, and source failure", async ({ page }) => {
  await page.evaluate(() => {
    card.hass = { ...hass, locale: { ...hass.locale, first_weekday: "sunday", time_format: "12" } };
  });
  await expect(page.locator(".family-day-header").first()).toContainText("Sun");
  await expect(page.locator(".family-event").filter({ hasText: "Simskola" }).first()).toContainText(/PM/i);
  await page.evaluate(() => { card.remove(); document.querySelector("#container").append(card); });
  await expect(page.locator(".family-event").first()).toBeVisible();
  await page.evaluate(() => { eventData = []; card.calendar.refetchEvents(); });
  await expect(page.locator(".family-event").filter({ hasText: "Simskola" })).toHaveCount(0);
  await page.evaluate(() => { card.hass.callApi = async () => { throw new Error("unavailable"); }; card.calendar.refetchEvents(); });
  await expect(page.getByRole("alert")).toContainText("Unable to load Person 1");
});

for (const language of ["sv", "sv-SE"]) {
  test(`Swedish ${language} localizes controls, navigation and event details`, async ({ page }) => {
    await page.evaluate((language) => mountCard({
      views: ["dayGridDay", "dayGridWeek", "dayGridTwoWeeks", "dayGridMonth", "multiMonthTwo", "list"],
      initialView: "dayGridDay",
    }, { language }), language);
    await expect(page.getByRole("button", { name: "Idag", exact: true })).toBeVisible();
    await expect(page.locator(".navigation")).toHaveAttribute("aria-label", "Kalendernavigering");
    await expect(page.getByRole("group", { name: "Kalendervy", exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Kalendrar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nästa", exact: true }).click();
    await expect(page.locator("header h2")).toContainText("16 september 2026");
    await page.getByRole("button", { name: "Förra", exact: true }).click();
    await expect(page.locator("header h2")).toContainText("15 september 2026");
    for (const [label, view] of [
      ["Vecka", "dayGridWeek"], ["Två veckor", "dayGridTwoWeeks"], ["Månad", "dayGridMonth"],
      ["Två månader", "multiMonthTwo"], ["Program", "list"], ["Dag", "dayGridDay"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      expect(await page.evaluate(() => card.calendar.view.type)).toBe(view);
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await page.evaluate(() => card.calendar.gotoDate("2026-09-15"));
    await page.locator(".family-event:visible").filter({ hasText: "Simskola" }).first().click();
    await expect(page.locator("dialog .event-dates")).toContainText("tisdag 15 september 2026");
    await expect(page.locator("dialog .event-dates")).toContainText(/14:30.*16:00/);
    await expect(page.locator("dialog")).toContainText("Plats: Pool");
    await expect(page.locator("dialog")).toContainText("Bring a towel");
    await page.getByRole("button", { name: "Stäng", exact: true }).click();
    await expect(page.locator("dialog")).not.toBeVisible();
  });
}

test("live language changes update open details and existing errors without resetting the calendar", async ({ page }) => {
  await page.getByRole("button", { name: "Week", exact: true }).click();
  const original = await page.evaluate(() => ({ date: card.calendar.getDate().toISOString(), view: card.calendar.view.type }));
  await (await visibleEvent(page)).click();
  await expect(page.locator("dialog")).toContainText("Location: Pool");
  for (const [language, location, close, date] of [
    ["sv-SE", "Plats", "Stäng", "tisdag 15 september 2026"],
    ["en", "Location", "Close", "Tuesday, September 15, 2026"],
  ]) {
    await page.evaluate((language) => {
      card.hass = { ...card.hass, locale: { ...card.hass.locale, language } };
    }, language);
    await expect(page.locator("dialog")).toBeVisible();
    await expect(page.locator("dialog")).toContainText(`${location}: Pool`);
    await expect(page.locator("dialog .event-dates")).toContainText(date);
    await expect(page.getByRole("button", { name: close, exact: true })).toBeVisible();
    expect(await page.evaluate(() => ({ date: card.calendar.getDate().toISOString(), view: card.calendar.view.type }))).toEqual(original);
  }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => {
    card.hass.callApi = async () => { throw new Error(); };
    card.calendar.refetchEvents();
  });
  await expect(page.getByRole("alert")).toContainText("Unable to load Person 1: calendar request failed");
  await page.evaluate(() => {
    card.hass = { ...card.hass, language: "sv", locale: { ...card.hass.locale, language: undefined } };
  });
  await expect(page.getByRole("alert")).toContainText("Kunde inte läsa in Person 1: kalenderförfrågan misslyckades");
  await expect(page.getByRole("button", { name: "Vecka", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("configuration changes while disconnected replace saved view and close details", async ({ page }) => {
  await (await visibleEvent(page)).click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.evaluate(async () => {
    card.remove();
    card.setConfig({ entities, views: ["dayGridDay"], initialView: "dayGridDay" });
    document.querySelector("#container").append(card);
    await card.updateComplete;
  });
  await expect(page.locator("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => card.calendar.view.type)).toBe("dayGridDay");
  await expect(page.locator(".views button")).toHaveCount(1);
});

test("two-month full-height view uses the tall container", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.evaluate(() => mountCard({ fillHeight: true, initialView: "multiMonthTwo" }));
  const calendar = await page.locator("#calendar").boundingBox();
  await expect.poll(async () => {
    const second = await page.locator(".family-month").nth(1).boundingBox();
    return second.y + second.height - calendar.y;
  }).toBeGreaterThan(calendar.height - 100);
  expect(await page.evaluate(() => card.calendar.view.type)).toBe("multiMonthTwo");
});

for (const fillHeight of [false, true]) {
  test(`two weeks keeps two rows of seven days and second-week overflow with fillHeight ${fillHeight}`, async ({ page }) => {
    await page.evaluate((fillHeight) => mountCard({ initialView: "dayGridTwoWeeks", firstDay: 1, fillHeight }), fillHeight);
    await expect(page.locator("header h2")).toContainText(/Sep 14\s*–\s*27, 2026/);
    const days = page.locator(".family-day-cell");
    await expect(days).toHaveCount(14);
    await expect(days.first()).toHaveAttribute("aria-label", "September 14, 2026");
    await expect(days.last()).toHaveAttribute("aria-label", "September 27, 2026");
    for (const width of [1080, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator(".family-day-header")).toHaveCount(7);
      await expect(days).toHaveCount(14);
      const [first, seventh, eighth, last] = await Promise.all([0, 6, 7, 13].map((index) => days.nth(index).boundingBox()));
      expect(seventh.y).toBe(first.y);
      expect(eighth.y).toBeGreaterThan(first.y);
      expect(eighth.x).toBe(first.x);
      expect(last.y).toBe(eighth.y);
      expect(last.x).toBe(seventh.x);
      expect(last.x + last.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => card.calendar.view.type)).toBe("dayGridTwoWeeks");
    }
    await expect(page.locator(".family-event").filter({ hasText: "Förskolan stängd" }).first().locator(".event-time")).toHaveCount(0);
    await expect(page.locator(".family-event").filter({ hasText: "Long timed trip" }).first().locator(".event-time")).toContainText("14:30");
    await page.screenshot({ path: `test-results/two-weeks-${fillHeight ? "panel" : "normal"}-${test.info().project.name}.png` });
    await page.getByRole("gridcell", { name: "September 25, 2026", exact: true }).locator(".family-more-link:visible").click();
    await expect(page.locator(".family-overflow .family-event")).toHaveCount(32);
  });
}

test("calendar toggles filter every view and allow all calendars to be hidden", async ({ page }) => {
  await page.evaluate(() => mountCard({ views: ["dayGridDay", "dayGridWeek", "dayGridTwoWeeks", "dayGridMonth", "multiMonthTwo", "list"] }));
  const controls = page.getByRole("group", { name: "Calendars", exact: true });
  await expect(controls.getByRole("button")).toHaveCount(4);
  expect(await controls.locator(".calendar-color").evaluateAll((colors) => new Set(colors.map((color) => getComputedStyle(color).backgroundColor)).size)).toBe(4);
  const person = controls.getByRole("button", { name: "Person 1", exact: true });
  for (const label of ["Day", "Week", "Two weeks", "Month", "Two months", "List"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.evaluate(() => card.calendar.gotoDate("2026-09-15"));
    const original = await page.evaluate(() => ({ date: card.calendar.getDate().toISOString(), view: card.calendar.view.type }));
    await expect(page.locator(".family-event").filter({ hasText: "Simskola" }).first()).toBeAttached();
    await person.click();
    await expect(person).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".family-event").filter({ hasText: "Simskola" })).toHaveCount(0);
    await expect(page.locator(".family-event").filter({ hasText: "Förskolan stängd" })).toHaveCount(0);
    await expect(page.locator(".family-event").filter({ hasText: "Person 2 appointment" }).first()).toBeAttached();
    expect(await page.evaluate(() => ({ date: card.calendar.getDate().toISOString(), view: card.calendar.view.type }))).toEqual(original);
    await person.click();
    await expect(person).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".family-event").filter({ hasText: "Simskola" }).first()).toBeAttached();
  }
  for (const button of await controls.getByRole("button").all()) await button.click();
  await expect(page.locator(".family-event")).toHaveCount(0);
  await expect(controls.locator('[aria-pressed="false"]')).toHaveCount(4);
  await person.focus();
  await page.keyboard.press("Space");
  await expect(person).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".family-event").filter({ hasText: "Simskola" }).first()).toBeAttached();
  await expect(page.locator(".family-event").filter({ hasText: "Person 2 appointment" })).toHaveCount(0);
});

test("hidden calendars stay hidden through navigation, preferences, refresh and reconnect", async ({ page }) => {
  const person = page.getByRole("group", { name: "Calendars", exact: true }).getByRole("button", { name: "Person 1", exact: true });
  await person.click();
  await page.evaluate(() => {
    window.calendarRequests = [];
    const callApi = card.hass.callApi;
    card.hass = { ...card.hass, callApi: (...args) => { calendarRequests.push(args[1]); return callApi(...args); } };
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("button", { name: "Two weeks", exact: true }).click();
  await page.evaluate(async () => {
    card.calendar.gotoDate("2026-09-15");
    card.hass = { ...card.hass, locale: { ...card.hass.locale, language: "sv", first_weekday: "sunday", time_format: "12" } };
    await card.updateComplete;
    card.calendar.refetchEvents();
    card.remove();
    document.querySelector("#container").append(card);
    await card.updateComplete;
  });
  const calendars = page.getByRole("group", { name: "Kalendrar", exact: true });
  await expect(calendars.getByRole("button", { name: "Person 1", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".family-event").filter({ hasText: "Person 2 appointment" }).first()).toBeAttached();
  await expect(page.locator(".family-event").filter({ hasText: "Simskola" })).toHaveCount(0);
  expect(await page.evaluate(() => calendarRequests.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => calendarRequests.some((url) => url.startsWith("calendars/calendar.person_1?")))).toBe(false);
  await page.evaluate(() => { eventData[0] = { ...eventData[0], summary: "Updated swimming lesson" }; });
  await calendars.getByRole("button", { name: "Person 1", exact: true }).click();
  await expect(page.locator(".family-event").filter({ hasText: "Updated swimming lesson" }).first()).toBeAttached();
});

test("calendar toggles ignore stale requests and clear errors for hidden calendars", async ({ page }) => {
  await page.evaluate(() => {
    window.pendingCalendarRequests = [];
    const callApi = card.hass.callApi;
    card.hass.callApi = (method, url) => url.startsWith("calendars/calendar.person_1?")
      ? new Promise((resolve, reject) => pendingCalendarRequests.push({ resolve, reject }))
      : callApi(method, url);
    card.calendar.refetchEvents();
  });
  await expect.poll(() => page.evaluate(() => pendingCalendarRequests.length)).toBe(1);
  const person = page.getByRole("group", { name: "Calendars", exact: true }).getByRole("button", { name: "Person 1", exact: true });
  await person.click();
  await expect(page.locator(".family-event").filter({ hasText: "Simskola" })).toHaveCount(0);
  await person.click();
  await expect.poll(() => page.evaluate(() => pendingCalendarRequests.length)).toBe(2);
  await page.evaluate(() => pendingCalendarRequests[1].resolve([{ summary: "Latest event", start: "2026-09-15", end: "2026-09-16" }]));
  await expect(page.locator(".family-event").filter({ hasText: "Latest event" })).toHaveCount(1);
  await page.evaluate(async () => {
    pendingCalendarRequests[0].reject(new Error("stale failure"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".family-event").filter({ hasText: "Latest event" })).toHaveCount(1);
  await page.evaluate(() => card.calendar.refetchEvents());
  await expect.poll(() => page.evaluate(() => pendingCalendarRequests.length)).toBe(3);
  await page.evaluate(() => pendingCalendarRequests[2].reject(new Error("current failure")));
  await expect(page.getByRole("alert")).toContainText("Unable to load Person 1: current failure");
  await person.click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
