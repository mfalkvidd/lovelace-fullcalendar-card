import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePreferences, formatEventDetails } from "../../src/format.js";

const auto = { firstDay: "auto", hour12: "auto" };
test("explicit YAML overrides conflicting HA preferences", () => {
  const hass = { locale: { language: "en-US", first_weekday: "sunday", time_format: "12" } };
  assert.deepEqual(resolvePreferences({ firstDay: 1, hour12: false }, hass), {
    language: "en-US", firstDay: 1, hour12: false, timeZone: "local",
  });
  assert.equal(resolvePreferences({ ...auto, firstDay: 0 }, { locale: { language: "sv", first_weekday: "monday" } }).firstDay, 0);
});
test("automatic follows all HA weekday names and hour preferences", () => {
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].forEach((day, index) => {
    assert.equal(resolvePreferences(auto, { locale: { language: "en", first_weekday: day } }).firstDay, index);
  });
  assert.equal(resolvePreferences(auto, { locale: { language: "en", time_format: "24" } }).hour12, false);
  assert.equal(resolvePreferences(auto, { locale: { language: "sv", time_format: "12" } }).hour12, true);
});
test("locale and system fallbacks", () => {
  for (const [language, firstDay, hour12] of [["sv-SE", 1, false], ["en-US", 0, true], ["en-GB", 1, false]]) {
    const preferences = resolvePreferences(auto, { language });
    assert.equal(preferences.firstDay, firstDay);
    assert.equal(preferences.hour12, hour12);
  }
  assert.equal(resolvePreferences(auto, { locale: { language: "en", time_format: "system" } }, "sv-SE").hour12, false);
});
test("server time zone is honored", () => {
  assert.equal(resolvePreferences(auto, { locale: { language: "sv", time_zone: "server" }, config: { time_zone: "Europe/Stockholm" } }).timeZone, "Europe/Stockholm");
});
test("details show full timed endpoints using the same preference", () => {
  const event = { start: new Date("2026-09-15T12:30:00Z"), end: new Date("2026-09-16T14:00:00Z"), allDay: false };
  const preferences = { language: "en", hour12: false, timeZone: "Europe/Stockholm" };
  assert.match(formatEventDetails(event, preferences), /14:30.*September 16, 2026.*16:00/);
  assert.match(formatEventDetails(event, { ...preferences, hour12: true }), /02:30 PM.*04:00 PM/);
});
test("all-day details show inclusive last day without time or timezone shifts", () => {
  const preferences = { language: "en", hour12: true, timeZone: "America/Los_Angeles" };
  const event = { allDay: true, startStr: "2026-09-17", endStr: "2026-09-20" };
  const result = formatEventDetails(event, preferences);
  assert.match(result, /September 17, 2026.*September 19, 2026/);
  assert.doesNotMatch(result, /September 20|AM|PM|00:00/);
});
