import locales from "fullcalendar/locales-all";

const english = {
  previous: "Previous",
  next: "Next",
  today: "Today",
  dayGridDay: "Day",
  dayGridWeek: "Week",
  dayGridTwoWeeks: "Two weeks",
  dayGridMonth: "Month",
  multiMonthTwo: "Two months",
  list: "List",
  close: "Close",
  calendar: "Calendar",
  navigation: "Calendar navigation",
  view: "Calendar view",
  location: "Location",
  requestFailed: "calendar request failed",
  loadError: (name, reason) => `Unable to load ${name}: ${reason}`,
};

// FullCalendar supplies the standard controls; these strings belong to the card.
const translations = {
  sv: {
    dayGridTwoWeeks: "Två veckor",
    multiMonthTwo: "Två månader",
    calendar: "Kalender",
    navigation: "Kalendernavigering",
    view: "Kalendervy",
    location: "Plats",
    requestFailed: "kalenderförfrågan misslyckades",
    loadError: (name, reason) => `Kunde inte läsa in ${name}: ${reason}`,
  },
};

const calendarKeys = {
  previous: "prevText",
  next: "nextText",
  today: "todayText",
  dayGridDay: "dayText",
  dayGridWeek: "weekTextLong",
  dayGridMonth: "monthText",
  list: "listText",
  close: "closeHint",
};
const localesByCode = new Map(locales.map((locale) => [locale.code, locale]));

export function getLabels(language = "en") {
  const codes = language.toLowerCase().split("-");
  const labels = { ...english, ...translations[codes[0]] };
  // Merge base and regional translations, retaining English for missing strings.
  for (let length = 1; length <= codes.length; length++) {
    const locale = localesByCode.get(codes.slice(0, length).join("-"));
    if (locale) {
      for (const [key, calendarKey] of Object.entries(calendarKeys)) {
        if (typeof locale[calendarKey] === "string") labels[key] = locale[calendarKey];
      }
    }
  }
  return labels;
}
