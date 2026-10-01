export const SUPPORTED_VIEWS = Object.freeze([
  "dayGridDay", "dayGridWeek", "dayGridTwoWeeks", "dayGridMonth", "multiMonthTwo", "list",
]);
const defaultViews = ["dayGridDay", "dayGridWeek", "dayGridMonth"];

function invalid(message) {
  throw new Error(`fullcalendar-card: ${message}`);
}

export function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    invalid("configuration must be an object.");
  }
  if (!Array.isArray(config.entities) || !config.entities.length) {
    invalid("entities must be a non-empty array of entity IDs or objects.");
  }
  const entities = config.entities.map((entry, index) => {
    const value = typeof entry === "string" ? { entity: entry } : entry;
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        typeof value.entity !== "string" || !/^\w+\.[\w]+$/.test(value.entity)) {
      invalid(`entities[${index}] needs a valid entity ID (for example calendar.home).`);
    }
    for (const key of ["name", "eventColor", "time_list_attribute"]) {
      if (value[key] !== undefined && typeof value[key] !== "string") {
        invalid(`entities[${index}].${key} must be a string.`);
      }
    }
    return { eventColor: "#3788d8", ...value };
  });
  const firstDay = config.firstDay ?? "auto";
  if (firstDay !== "auto" && !(Number.isInteger(firstDay) && firstDay >= 0 && firstDay <= 6)) {
    invalid("firstDay must be auto or an integer from 0 (Sunday) to 6 (Saturday).");
  }
  const hour12 = config.hour12 ?? "auto";
  if (hour12 !== "auto" && typeof hour12 !== "boolean") {
    invalid("hour12 must be auto, true, or false.");
  }
  for (const key of ["displayEventEnd", "fillHeight", "weekNumbers", "timeBasedLayout"]) {
    if (config[key] !== undefined && typeof config[key] !== "boolean") {
      invalid(`${key} must be true or false.`);
    }
  }
  const weekNumberCalculation = config.weekNumberCalculation ?? "ISO";
  if (!["ISO", "US", "local"].includes(weekNumberCalculation)) {
    invalid("weekNumberCalculation must be ISO, US, or local.");
  }
  const twoMonthLayout = config.twoMonthLayout ?? "vertical";
  if (!["vertical", "horizontal"].includes(twoMonthLayout)) {
    invalid("twoMonthLayout must be vertical or horizontal.");
  }
  const views = config.views ?? defaultViews;
  if (!Array.isArray(views) || !views.length ||
      views.some((view) => !SUPPORTED_VIEWS.includes(view))) {
    invalid(`views must be a non-empty array containing only: ${SUPPORTED_VIEWS.join(", ")}.`);
  }
  if (new Set(views).size !== views.length) invalid("views must not contain duplicates.");
  const initialView = config.initialView ?? (views.includes("dayGridMonth") ? "dayGridMonth" : views[0]);
  if (!views.includes(initialView)) {
    invalid(`initialView '${initialView}' must be one of the configured views: ${views.join(", ")}.`);
  }
  if (config.theme !== undefined && typeof config.theme !== "string") invalid("theme must be a string.");
  return {
    ...config, entities, firstDay, hour12, views: [...views], initialView,
    displayEventEnd: config.displayEventEnd ?? true,
    fillHeight: config.fillHeight ?? false,
    timeBasedLayout: config.timeBasedLayout ?? false,
    weekNumbers: config.weekNumbers ?? true,
    weekNumberCalculation,
    twoMonthLayout,
  };
}
