import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig } from "../../src/config.js";

const basic = { entities: [{ entity: "calendar.home_calendar", eventColor: "green" }] };
test("old calendar YAML and string entities retain sensible defaults", () => {
  const config = normalizeConfig(basic);
  assert.equal(config.initialView, "dayGridMonth");
  assert.deepEqual(config.views, ["dayGridDay", "dayGridWeek", "dayGridMonth"]);
  assert.equal(config.firstDay, "auto");
  assert.equal(config.hour12, "auto");
  assert.equal(config.displayEventEnd, true);
  assert.equal(config.fillHeight, false);
  assert.equal(config.entities[0].eventColor, "green");
  assert.equal(normalizeConfig({ entities: ["sensor.meeting"] }).entities[0].entity, "sensor.meeting");
  assert.equal(basic.entities[0].name, undefined);
});
test("custom order, custom initial view, and first-only fallback", () => {
  assert.deepEqual(normalizeConfig({ ...basic, views: ["multiMonthTwo", "dayGridWeek"] }).views, ["multiMonthTwo", "dayGridWeek"]);
  assert.equal(normalizeConfig({ ...basic, views: ["multiMonthTwo", "dayGridWeek"] }).initialView, "multiMonthTwo");
  assert.equal(normalizeConfig({ ...basic, initialView: "dayGridDay" }).initialView, "dayGridDay");
});
for (const [key, value] of [
  ["firstDay", 9], ["firstDay", -1], ["firstDay", 1.5], ["firstDay", "1"],
  ["hour12", "false"], ["displayEventEnd", "true"], ["fillHeight", 1],
  ["initialView", "doesNotExist"], ["views", "dayGridMonth"], ["views", []],
  ["views", ["unknown"]], ["views", ["dayGridDay", "dayGridDay"]],
  ["entities", [null]], ["entities", [{}]], ["entities", []],
]) {
  test(`rejects invalid ${key}: ${JSON.stringify(value)}`, () => {
    assert.throws(() => normalizeConfig({ ...basic, [key]: value }), new RegExp(key));
  });
}
test("all numeric weekdays including Sunday and boolean false are preserved", () => {
  for (let firstDay = 0; firstDay < 7; firstDay++) {
    const config = normalizeConfig({ ...basic, firstDay, hour12: false, displayEventEnd: false });
    assert.equal(config.firstDay, firstDay);
    assert.equal(config.hour12, false);
    assert.equal(config.displayEventEnd, false);
  }
});
