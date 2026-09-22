import { LitElement, html, nothing } from "lit";
import { Calendar } from "fullcalendar";
import dayGridPlugin from "fullcalendar/daygrid";
import listPlugin from "fullcalendar/list";
import multiMonthPlugin from "fullcalendar/multimonth";
import classicTheme from "fullcalendar/themes/classic";
import locales from "fullcalendar/locales-all";
import { CalendarService, calendarName } from "./data.js";
import { normalizeConfig } from "./config.js";
import { resolvePreferences, eventTimeFormat, formatEventDetails } from "./format.js";
import { getLabels } from "./localize.js";
import { styles } from "./styles.js";

const previousPath = "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z";
const nextPath = "M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z";

export class FullCalendarCard extends LitElement {
  static properties = {
    _config: { state: true },
    _hass: { state: true },
    _title: { state: true },
    _activeView: { state: true },
    _selectedEvent: { state: true },
    _errors: { state: true },
  };
  static styles = styles;

  constructor() {
    super();
    this._service = new CalendarService();
    this._errors = new Map();
    this._themeKeys = [];
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._savedView = undefined;
    this._savedDate = undefined;
    this.renderRoot?.querySelector("dialog")?.close();
    this.toggleAttribute("fill-height", this._config.fillHeight);
  }

  set hass(value) { this._hass = value; }
  get hass() { return this._hass; }
  getCardSize() { return 8; }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
    // Calendar entities may change future events without changing their current state.
    this._refreshTimer = setInterval(() => {
      if (!document.hidden) this.calendar?.refetchEvents();
    }, 60000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._refreshTimer);
    this._savedView = this.calendar?.view.type;
    this._savedDate = this.calendar?.getDate();
    this.calendar?.destroy();
    this.calendar = undefined;
    this._selectedEvent = undefined;
  }

  updated(changed) {
    if (!this._config || !this._hass || !this.isConnected) return;
    const preferences = resolvePreferences(this._config, this._hass);
    const preferencesChanged = JSON.stringify(preferences) !== JSON.stringify(this._preferences);
    this._preferences = preferences;
    if (changed.has("_config") && this.calendar) {
      this.calendar.destroy();
      this.calendar = undefined;
      this._savedView = undefined;
      this._savedDate = undefined;
      this._selectedEvent = undefined;
      this._errors = new Map();
    }
    if (!this.calendar) this._createCalendar();
    else if (preferencesChanged) {
      this.calendar.batchRendering(() => {
        this.calendar.setOption("locale", preferences.language);
        this.calendar.setOption("firstDay", preferences.firstDay);
        this.calendar.setOption("timeZone", preferences.timeZone);
        this.calendar.setOption("eventTimeFormat", eventTimeFormat(preferences.hour12));
      });
    }
    if (changed.has("_hass") || changed.has("_config")) {
      const oldHass = changed.get("_hass");
      if (oldHass && this._config.entities.some(({ entity }) => oldHass.states?.[entity] !== this._hass.states?.[entity])) {
        this.calendar.refetchEvents();
      }
      this._applyTheme();
    }
    // FullCalendar 7 observes its containers with ResizeObserver. destroy() releases
    // those observers; no window resize listener or deprecated updateSize() is needed.
  }

  _createCalendar() {
    const config = this._config;
    const preferences = this._preferences;
    this.calendar = new Calendar(this.renderRoot.querySelector("#calendar"), {
      plugins: [classicTheme, dayGridPlugin, listPlugin, multiMonthPlugin],
      locales,
      locale: preferences.language,
      firstDay: preferences.firstDay,
      timeZone: preferences.timeZone,
      initialView: this._savedView || config.initialView,
      ...(this._savedDate ? { initialDate: this._savedDate } : {}),
      headerToolbar: false,
      height: config.fillHeight ? "100%" : "auto",
      views: {
        multiMonthTwo: {
          type: "multiMonth", duration: { months: 2 },
          dateIncrement: { months: 2 }, dateAlignment: "month",
        },
        list: { type: "list", duration: { weeks: 1 } },
      },
      multiMonthMaxColumns: 1,
      singleMonthTitleFormat: { month: "long", year: "numeric" },
      // Disable FullCalendar's own narrow-day event collapse as well as the old card breakpoint.
      dayNarrowWidth: 0,
      eventDisplay: "block",
      eventInteractive: true,
      displayEventEnd: config.displayEventEnd,
      eventTimeFormat: eventTimeFormat(preferences.hour12),
      dayMaxEvents: config.fillHeight ? true : 5,
      moreLinkClick: "popover",
      eventClass: "family-event",
      eventInnerClass: "family-event-inner",
      dayHeaderClass: "family-day-header",
      dayCellClass: "family-day-cell",
      singleMonthClass: "family-month",
      singleMonthHeaderClass: "family-month-header",
      tableBodyClass: ({ multiMonthColumns }) => multiMonthColumns ? "family-month-body" : "",
      moreLinkClass: "family-more-link",
      popoverClass: "family-overflow",
      eventContent: (info) => {
        // FullCalendar owns the time range and all-day semantics. Only wrap its text for readability.
        const nodes = [];
        let timeText = info.timeText;
        // FullCalendar 7 suppresses timeText in its smallest cells even with
        // dayNarrowWidth: 0. Use its public formatter in that case, without changing titles.
        if (!timeText && !info.event.allDay && (info.isStart || info.isEnd)) {
          const format = eventTimeFormat(this._preferences.hour12);
          timeText = config.displayEventEnd && info.event.end
            ? this.calendar.formatRange(info.event.start, info.event.end, format)
            : this.calendar.formatDate(info.event.start, format);
        }
        if (timeText && !info.event.allDay) {
          const time = document.createElement("span");
          time.className = "event-time";
          time.textContent = `${timeText} `;
          nodes.push(time);
        }
        const title = document.createElement("span");
        title.className = "event-title";
        title.textContent = info.event.title;
        nodes.push(title);
        return { domNodes: nodes };
      },
      eventClick: (info) => this._openEvent(info.event),
      datesSet: ({ view }) => {
        this._title = view.title;
        this._activeView = view.type;
      },
      eventSources: config.entities.map((entity, index) => ({
        id: `${entity.entity}-${index}`,
        color: entity.eventColor,
        events: async ({ start, end }) => {
          try {
            const events = await this._service.getEvents(this._hass, entity, start, end);
            if (this._config === config && this._errors.has(index)) {
              this._errors = new Map(this._errors);
              this._errors.delete(index);
            }
            return events;
          } catch (error) {
            if (this._config === config) {
              this._errors = new Map(this._errors).set(index, {
                name: calendarName(this._hass, entity), reason: error.message,
              });
            }
            return [];
          }
        },
      })),
    });
    this.calendar.render();
  }

  _applyTheme() {
    for (const key of this._themeKeys) this.style.removeProperty(key);
    this._themeKeys = [];
    const themes = this._hass.themes;
    const theme = themes?.themes?.[this._config.theme];
    if (!theme) return;
    const values = { ...theme, ...theme.modes?.[themes.darkMode ? "dark" : "light"] };
    for (const [key, value] of Object.entries(values)) {
      if (key !== "modes" && (typeof value === "string" || typeof value === "number")) {
        this.style.setProperty(`--${key}`, String(value));
        this._themeKeys.push(`--${key}`);
      }
    }
  }

  async _openEvent(event) {
    this._selectedEvent = event;
    await this.updateComplete;
    if (!this.isConnected || this._selectedEvent !== event) return;
    this.renderRoot.querySelector("dialog").showModal();
  }

  _button(label, action, active = undefined) {
    // Do not load HA's private card modules just to register a control.
    return customElements.get("ha-button")
      ? html`<ha-button size="small" appearance=${active ? "filled" : "plain"}
          aria-pressed=${active === undefined ? nothing : String(active)}
          @click=${action}>${label}</ha-button>`
      : html`<button type="button" aria-pressed=${active === undefined ? nothing : String(active)}
          @click=${action}>${label}</button>`;
  }

  _navigationButton(label, path, action) {
    return customElements.get("ha-icon-button")
      ? html`<ha-icon-button .path=${path} .label=${label} @click=${action}></ha-icon-button>`
      : html`<button type="button" class="icon-button" aria-label=${label} @click=${action}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${path}></path></svg>
        </button>`;
  }

  render() {
    if (!this._config) return nothing;
    const event = this._selectedEvent;
    const preferences = resolvePreferences(this._config, this._hass);
    const labels = getLabels(preferences.language);
    return html`
      <ha-card>
        <header>
          <div class="navigation" aria-label=${labels.navigation}>
            ${this._navigationButton(labels.previous, previousPath, () => this.calendar?.prev())}
            ${this._button(labels.today, () => this.calendar?.today())}
            ${this._navigationButton(labels.next, nextPath, () => this.calendar?.next())}
          </div>
          <h2 aria-live="polite">${this._title || labels.calendar}</h2>
          <div class="views" role="group" aria-label=${labels.view}>
            ${this._config.views.map((view) => this._button(labels[view],
              () => this.calendar?.changeView(view), this._activeView === view))}
          </div>
        </header>
        ${this._errors.size ? html`<div class="errors" role="alert">
          ${[...this._errors.values()].map((error) => html`<p>${labels.loadError(error.name, error.reason || labels.requestFailed)}</p>`)}
        </div>` : nothing}
        <div class="calendar-container"><div id="calendar"></div></div>
      </ha-card>
      <dialog aria-labelledby="event-title" @close=${() => { this._selectedEvent = undefined; }}>
        ${event ? html`
          <h2 id="event-title">${event.title}</h2>
          <p class="event-dates">${formatEventDetails(event, preferences)}</p>
          <p class="event-calendar">${event.extendedProps.calendarName}</p>
          ${event.extendedProps.location ? html`<p>${labels.location}: ${event.extendedProps.location}</p>` : nothing}
          ${event.extendedProps.description ? html`<p class="description">${event.extendedProps.description}</p>` : nothing}
          <div class="dialog-actions">${this._button(labels.close, () => this.renderRoot.querySelector("dialog").close())}</div>
        ` : nothing}
      </dialog>`;
  }
}

if (!customElements.get("fullcalendar-card")) customElements.define("fullcalendar-card", FullCalendarCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "fullcalendar-card", name: "FullCalendar", description: "A multi-calendar family dashboard" });
