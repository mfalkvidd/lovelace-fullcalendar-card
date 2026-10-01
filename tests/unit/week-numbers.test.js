import { test } from "node:test";
import assert from "node:assert/strict";
import { createWeekNumberCalculation } from "../../src/week-numbers.js";

test("ISO week numbers handle both ends of the week-year and leap years", () => {
  const week = createWeekNumberCalculation("ISO", "UTC");
  for (const [date, expected] of [
    ["2015-12-31", 53], ["2016-01-01", 53], ["2016-01-03", 53], ["2016-01-04", 1],
    ["2019-12-30", 1], ["2020-02-29", 9], ["2020-12-28", 53],
    ["2021-01-01", 53], ["2021-01-03", 53], ["2021-01-04", 1],
    ["2026-12-31", 53], ["2027-01-01", 53], ["2027-01-04", 1],
  ]) assert.equal(week(new Date(`${date}T12:00:00Z`)), expected, date);
});

test("US weeks start on Sunday and week one contains January first", () => {
  const week = createWeekNumberCalculation("US", "UTC");
  for (const [date, expected] of [
    ["2020-12-26", 52], ["2020-12-27", 1], ["2021-01-01", 1],
    ["2021-01-02", 1], ["2021-01-03", 2], ["2022-12-31", 53], ["2023-01-01", 1],
  ]) assert.equal(week(new Date(`${date}T12:00:00Z`)), expected, date);
});

test("week numbers use the calendar time zone, including extreme offsets and daylight saving", () => {
  const date = new Date("2021-01-03T23:30:00Z");
  assert.equal(createWeekNumberCalculation("ISO", "Europe/Stockholm")(date), 1);
  assert.equal(createWeekNumberCalculation("ISO", "America/Los_Angeles")(date), 53);
  const boundary = new Date("2021-01-03T12:00:00Z");
  assert.equal(createWeekNumberCalculation("ISO", "Pacific/Kiritimati")(boundary), 1);
  assert.equal(createWeekNumberCalculation("ISO", "Pacific/Honolulu")(boundary), 53);
  const stockholm = createWeekNumberCalculation("ISO", "Europe/Stockholm");
  assert.equal(stockholm(new Date("2026-03-29T22:00:00Z")), 14);
  assert.equal(stockholm(new Date("2026-10-25T23:00:00Z")), 44);
  assert.equal(createWeekNumberCalculation("US", "Europe/Stockholm")(new Date("2021-01-02T23:30:00Z")), 2);
});

test("local calculation delegates to FullCalendar while local time uses browser calendar dates", () => {
  assert.equal(createWeekNumberCalculation("local"), "local");
  assert.equal(createWeekNumberCalculation("ISO")(new Date(2021, 0, 4)), 1);
  assert.equal(createWeekNumberCalculation("ISO")(new Date(2021, 0, 3)), 53);
});
