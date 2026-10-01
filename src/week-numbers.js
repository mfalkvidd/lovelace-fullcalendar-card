const dayMs = 86400000;

function firstWeekStart(year, firstDay, anchorDay) {
  const anchor = new Date(0);
  anchor.setUTCFullYear(year, 0, anchorDay);
  return anchor.getTime() - ((anchor.getUTCDay() - firstDay + 7) % 7) * dayMs;
}

export function createWeekNumberCalculation(method, timeZone = "local") {
  if (method === "local") return "local";
  const iso = method === "ISO";
  const firstDay = iso ? 1 : 0;
  const anchorDay = iso ? 4 : 1;
  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory", numberingSystem: "latn",
    year: "numeric", month: "numeric", day: "numeric",
    ...(timeZone === "local" ? {} : { timeZone }),
  });
  // FullCalendar's built-in ISO calculation also uses firstDay. Keep these
  // explicit numbering systems independent of the grid's chosen first weekday.
  return (date) => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, Number(value)]));
    const day = new Date(0);
    day.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    let start = firstWeekStart(parts.year, firstDay, anchorDay);
    if (day.getTime() < start) start = firstWeekStart(parts.year - 1, firstDay, anchorDay);
    else {
      const nextStart = firstWeekStart(parts.year + 1, firstDay, anchorDay);
      if (day.getTime() >= nextStart) start = nextStart;
    }
    // Work with calendar dates in UTC, so daylight-saving changes cannot shift a week.
    return Math.floor((day.getTime() - start) / (7 * dayMs)) + 1;
  };
}
