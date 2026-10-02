import { test } from "node:test";
import assert from "node:assert/strict";
import { CalendarService, calendarEvent, calendarName, eventSignature } from "../../src/data.js";

test("HA all-day semantics and exclusive end are preserved", () => {
  assert.deepEqual(calendarEvent({ summary: "Holiday", start: { date: "2026-09-17" }, end: { date: "2026-09-20" } }, "Home"), {
    title: "Holiday", start: "2026-09-17", end: "2026-09-20", allDay: true,
    extendedProps: { calendarName: "Home", description: "", location: "" },
  });
  assert.equal(calendarEvent({ start: "2026-09-17" }, "Home").allDay, true);
});
test("multi-day timed events stay timed, optional ends are accepted", () => {
  assert.equal(calendarEvent({ start: "2026-09-17T10:00:00Z", end: "2026-09-20T12:00:00Z" }, "Home").allDay, false);
  assert.equal(calendarEvent({ start: { dateTime: "2026-09-17T10:00:00Z" } }, "Home").end, undefined);
});
test("calendar naming uses override, friendly name, then entity ID", () => {
  const hass = { states: { "calendar.home": { attributes: { friendly_name: "Home" } } } };
  assert.equal(calendarName(hass, { entity: "calendar.home", name: "Family" }), "Family");
  assert.equal(calendarName(hass, { entity: "calendar.home" }), "Home");
  assert.equal(calendarName(hass, { entity: "calendar.missing" }), "calendar.missing");
});
test("fresh API responses replace removed events and include the requested range", async () => {
  const service = new CalendarService();
  let response = [{ summary: "Old", start: "2026-09-17" }];
  const hass = { callApi: async (method, url) => {
    assert.equal(method, "get");
    const parsed = new URL(url, "http://localhost/");
    assert.equal(parsed.searchParams.get("start"), "2026-09-01T00:00:00.000Z");
    assert.equal(parsed.searchParams.get("end"), "2026-10-01T00:00:00.000Z");
    return response;
  } };
  const args = [hass, { entity: "calendar.home" }, new Date("2026-09-01Z"), new Date("2026-10-01Z")];
  assert.equal((await service.getEvents(...args)).length, 1);
  response = [];
  assert.deepEqual(await service.getEvents(...args), []);
});
test("timestamp and time-list sensors remain supported; unavailable dates are omitted", async () => {
  const service = new CalendarService();
  const config = { entity: "sensor.meeting" };
  const state = { state: "2026-09-17T10:00:00Z", attributes: { device_class: "timestamp", friendly_name: "Meeting", dates: ["2026-09-18", "2026-09-20"] } };
  const hass = { states: { "sensor.meeting": state } };
  assert.equal((await service.getEvents(hass, config))[0].start, state.state);
  assert.deepEqual((await service.getEvents(hass, { ...config, time_list_attribute: "dates" })).map((e) => e.start), state.attributes.dates);
  state.state = "unavailable";
  assert.deepEqual(await service.getEvents(hass, config), []);
  assert.deepEqual(await service.getEvents(hass, { entity: "sensor.missing" }), []);
});

test("refresh signature ignores response order but detects edits and duplicate changes", () => {
  const a = calendarEvent({ summary: "Meeting", start: "2026-09-17", description: "First" }, "Home");
  const b = calendarEvent({ summary: "Lunch", start: "2026-09-18" }, "Home");
  assert.equal(eventSignature([a, b]), eventSignature([b, a]));
  assert.notEqual(eventSignature([a, b]), eventSignature([a, b, b]));
  assert.notEqual(eventSignature([a, b]), eventSignature([{ ...a, extendedProps: { ...a.extendedProps, description: "Changed" } }, b]));
});
