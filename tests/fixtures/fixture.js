import "/lovelace-fullcalendar-card.js";

window.entities = ["#4A90E2", "#E27D4A", "#72B572", "#B77AC4"].map((eventColor, i) => ({
  entity: `calendar.person_${i + 1}`, eventColor,
}));
window.eventData = [
  { summary: "Simskola", start: { dateTime: "2026-09-15T14:30:00+02:00" }, end: { dateTime: "2026-09-15T16:00:00+02:00" }, description: "Bring a towel", location: "Pool" },
  { summary: "Förskolan stängd", start: { date: "2026-09-15" }, end: { date: "2026-09-16" } },
  { summary: "Holiday", start: { date: "2026-09-17" }, end: { date: "2026-09-20" } },
  { summary: "Long timed trip", start: { dateTime: "2026-09-21T14:30:00+02:00" }, end: { dateTime: "2026-09-23T16:00:00+02:00" } },
];
window.mountCard = async (config = {}, locale = {}) => {
  document.querySelector("fullcalendar-card")?.remove();
  window.card = document.createElement("fullcalendar-card");
  window.hass = {
    language: "en",
    locale: { language: "en", first_weekday: "monday", time_format: "24", ...locale },
    config: { time_zone: "Europe/Stockholm" },
    states: Object.fromEntries(window.entities.map(({ entity }, i) => [entity, { attributes: { friendly_name: `Person ${i + 1}` } }])),
    callApi: async (_method, url) => {
      const person = Number(url.match(/person_(\d)/)[1]);
      const main = person === 1 ? window.eventData : [{ ...window.eventData[0], summary: `Person ${person} appointment` }];
      return [...main, ...Array.from({ length: 8 }, (_, i) => ({
        summary: `Busy ${person}-${i}`,
        start: { dateTime: `2026-09-25T${String(i + 8).padStart(2, "0")}:00:00+02:00` },
        end: { dateTime: `2026-09-25T${String(i + 9).padStart(2, "0")}:00:00+02:00` },
      }))];
    },
  };
  card.setConfig({ entities: window.entities, views: ["dayGridDay", "dayGridWeek", "dayGridMonth", "multiMonthTwo"], ...config });
  card.hass = window.hass;
  document.querySelector("#container").append(card);
  await card.updateComplete;
  card.calendar.gotoDate("2026-09-15");
  await card.updateComplete;
};
await mountCard();
