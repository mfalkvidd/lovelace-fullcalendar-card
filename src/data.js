function eventDate(value) {
  return value?.date ?? value?.dateTime ?? value;
}
const isDateOnly = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function calendarName(hass, config) {
  return config.name || hass.states?.[config.entity]?.attributes?.friendly_name || config.entity;
}

export function calendarEvent(data, name) {
  const start = eventDate(data.start);
  const end = eventDate(data.end);
  return {
    title: data.summary ?? data.title ?? "",
    start,
    ...(end ? { end } : {}),
    // Duration does not determine all-day status: a 48-hour timed event is still timed.
    allDay: isDateOnly(start),
    extendedProps: {
      calendarName: name,
      description: data.description ?? "",
      location: data.location ?? "",
    },
  };
}

export class CalendarService {
  async getEvents(hass, config, start, end) {
    if (!hass) return [];
    const name = calendarName(hass, config);
    if (config.entity.startsWith("calendar.")) {
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
      const data = await hass.callApi("get", `calendars/${encodeURIComponent(config.entity)}?${params}`);
      // Return this range's fresh response. Appending old responses leaves deleted events behind.
      return data.map((event) => calendarEvent(event, name));
    }
    const state = hass.states?.[config.entity];
    if (!state) return [];
    const attributes = state.attributes ?? {};
    const startDate = attributes.device_class === "timestamp"
      ? state.state : (attributes.last_changed ?? state.last_changed);
    const dates = config.time_list_attribute && Array.isArray(attributes[config.time_list_attribute])
      ? attributes[config.time_list_attribute] : [startDate];
    return dates.filter((date) => typeof date === "string" && !Number.isNaN(Date.parse(date)))
      .map((date) => ({
        title: name, start: date, allDay: true,
        extendedProps: { calendarName: name },
      }));
  }
}
