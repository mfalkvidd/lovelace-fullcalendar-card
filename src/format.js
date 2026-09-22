import { getWeekStartByLocale } from "weekstart";

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function resolvePreferences(config, hass = {}, systemLanguage = globalThis.navigator?.language ?? "en") {
  const language = hass.locale?.language || hass.language || systemLanguage;
  let firstDay = config.firstDay;
  if (firstDay === "auto") {
    const preference = hass.locale?.first_weekday;
    if (weekdays.includes(preference)) firstDay = weekdays.indexOf(preference);
    else if (Number.isInteger(preference) && preference >= 0 && preference <= 6) firstDay = preference;
    else {
      const locale = new Intl.Locale(language);
      const weekInfo = locale.getWeekInfo?.() ?? locale.weekInfo;
      // Firefox versions without Intl week data use the same CLDR fallback as HA.
      firstDay = weekInfo ? weekInfo.firstDay % 7 : getWeekStartByLocale(language) % 7;
    }
  }
  let hour12 = config.hour12;
  if (hour12 === "auto") {
    const preference = hass.locale?.time_format;
    if (preference === "12") hour12 = true;
    else if (preference === "24") hour12 = false;
    else {
      hour12 = new Intl.DateTimeFormat(preference === "system" ? systemLanguage : language,
        { hour: "numeric" }).resolvedOptions().hour12;
    }
  }
  const timeZone = hass.locale?.time_zone === "server" && hass.config?.time_zone
    ? hass.config.time_zone : "local";
  return { language, firstDay, hour12, timeZone };
}

export function eventTimeFormat(hour12) {
  return { hour: "2-digit", minute: "2-digit", hour12, meridiem: "short", omitZeroMinute: false };
}

export function formatEventDetails(event, preferences) {
  const { language, hour12, timeZone } = preferences;
  const dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  if (event.allDay) {
    // Floating calendar dates must not shift with the user's time zone. HA ends are exclusive.
    const start = new Date(`${event.startStr.slice(0, 10)}T12:00:00`);
    const end = event.endStr ? new Date(`${event.endStr.slice(0, 10)}T12:00:00`) : new Date(start);
    if (event.endStr) end.setDate(end.getDate() - 1);
    const formatter = new Intl.DateTimeFormat(language, dateOptions);
    return start.getTime() === end.getTime()
      ? formatter.format(start) : `${formatter.format(start)} – ${formatter.format(end)}`;
  }
  const formatter = new Intl.DateTimeFormat(language, {
    ...dateOptions, hour: "2-digit", minute: "2-digit", hour12,
    ...(timeZone === "local" ? {} : { timeZone }),
  });
  return `${formatter.format(event.start)}${event.end ? ` – ${formatter.format(event.end)}` : ""}`;
}
