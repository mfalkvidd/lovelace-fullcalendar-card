import { test } from "node:test";
import assert from "node:assert/strict";
import { eventTimePlacement, timeBasedEventOrder, placeTimedEvents, spreadDaytimeEvents } from "../../src/time-layout.js";

const timed = (time, end = "23:59:00") => ({ allDay: false, startStr: `2026-09-15T${time}+02:00`, endStr: `2026-09-15T${end}+02:00` });
const block = (minute, height = 20) => ({ minute, height });

test("07:00 and 18:00 belong to daytime, with strict early/late boundaries", () => {
  for (const [time, band] of [["06:59:59", "early"], ["07:00:00", "daytime"], ["12:30:00", "daytime"], ["18:00:00", "daytime"], ["18:00:01", "late"]]) {
    assert.equal(eventTimePlacement(timed(time)).band, band);
  }
  assert.equal(eventTimePlacement(timed("12:30:00")).minute, 750);
});

test("all-day and timed events crossing a calendar date use the top band, respecting exclusive ends", () => {
  assert.equal(eventTimePlacement({ allDay: true, startStr: "2026-09-15", endStr: "2026-09-16" }).band, "top");
  assert.equal(eventTimePlacement({ ...timed("22:00:00"), endStr: "2026-09-16T01:00:00+02:00" }).band, "top");
  assert.equal(eventTimePlacement({ ...timed("22:00:00"), endStr: "2026-09-16T00:00:00+02:00" }).band, "late");
  assert.equal(eventTimePlacement({ ...timed("22:00:00"), endStr: "2026-09-16T00:00:00.001+02:00" }).band, "top");
});

test("classification uses displayed wall-clock times across UTC offsets and daylight saving", () => {
  assert.deepEqual(eventTimePlacement({ allDay: false, startStr: "2026-10-25T06:30:00+01:00", endStr: "2026-10-25T08:00:00+01:00" }), { minute: 390, band: "early" });
  assert.equal(eventTimePlacement({ allDay: false, startStr: "2026-09-15T12:30:00-10:00", endStr: "2026-09-15T13:00:00-10:00" }).minute, 750);
});

test("native event order puts spanning and all-day events above an earlier same-day event", () => {
  const start = Date.UTC(2026, 8, 15);
  const events = [
    { title: "early", start: start + 3600000, end: start + 7200000, allDay: false },
    { title: "spanning", start: start + 72000000, end: start + 90000000, allDay: false },
    { title: "all-day", start, end: start + 86400000, allDay: true },
  ];
  assert.deepEqual(events.sort(timeBasedEventOrder).map((e) => e.title), ["all-day", "spanning", "early"]);
});

test("12:30 is centered in the middle remaining after the early and late groups", () => {
  const placed = placeTimedEvents([block(1320), block(750), block(300), block(1140), block(390)], 100, 500);
  const at = (minute) => placed.find(({ item }) => item.minute === minute).top;
  assert.equal(at(300), 100);
  assert.equal(at(390), 122);
  assert.equal(at(1140), 458);
  assert.equal(at(1320), 480);
  assert.equal(at(750) + 10, (144 + 456) / 2);
});

test("daytime follows the 07:00–18:00 scale rather than evenly spacing events", () => {
  const placed = spreadDaytimeEvents([block(420), block(540), block(750), block(1080)], 0, 1100);
  assert.equal(placed[0].top, 0);
  assert.equal(placed[1].top + 10, 200);
  assert.equal(placed[2].top + 10, 550);
  assert.equal(placed[3].top, 1080);
});

test("equal start times separate symmetrically and variable heights never overlap", () => {
  const centered = spreadDaytimeEvents([block(750), block(750), block(750)], 0, 200);
  assert.deepEqual(centered.map((x) => x.top), [68, 90, 112]);
  const placed = placeTimedEvents([block(300, 25), block(420, 18), block(749, 55), block(750, 30), block(751, 22), block(1080, 45), block(1320, 26)], 0, 300);
  for (let i = 1; i < placed.length; i++) assert.ok(placed[i].top >= placed[i - 1].top + placed[i - 1].item.height);
  assert.ok(placed[0].top >= 0);
  assert.ok(placed.at(-1).top + placed.at(-1).item.height <= 300);
});

test("crowding compresses gaps but leaves overflow decisions to FullCalendar", () => {
  const placed = placeTimedEvents([block(300), block(750), block(1320)], 0, 60);
  assert.deepEqual(placed.map((x) => x.top), [0, 20, 40]);
  assert.equal(placeTimedEvents([block(300), block(750), block(1320)], 0, 59), null);
  assert.deepEqual(placeTimedEvents([], 0, 0), []);
});
