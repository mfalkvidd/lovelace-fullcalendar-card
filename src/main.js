import { LitElement, html, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { Calendar } from "fullcalendar";
import dayGridPlugin from "fullcalendar/daygrid";
import listPlugin from "fullcalendar/list";
import multiMonthPlugin from "fullcalendar/multimonth";
import classicTheme from "fullcalendar/themes/classic";
import locales from "fullcalendar/locales-all";
import { CalendarService, calendarName, eventSignature } from "./data.js";
import { normalizeConfig } from "./config.js";
import { resolvePreferences, eventTimeFormat, formatEventDetails } from "./format.js";
import { getLabels } from "./localize.js";
import { createWeekNumberCalculation } from "./week-numbers.js";
import { styles } from "./styles.js";
import { TimeBasedLayout, eventTimePlacement, timeBasedEventOrder } from "./time-layout.js";

const previousPath = "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z";
const nextPath = "M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z";

export class FullCalendarCard extends LitElement {
  static properties = {
    _config: { state: true },
    _hass: { state: true },
    _title: { state: true },
    _weekTitle: { state: true },
    _activeView: { state: true },
    _selectedEvent: { state: true },
    _errors: { state: true },
    _hiddenCalendars: { state: true },
  };
  static styles = styles;

  constructor() {
    super();
    this._service = new CalendarService();
    this._errors = new Map();
    this._hiddenCalendars = new Set();
    this._sourceRequests = new Map();
    this._sourceSnapshots = new Map();
    this._themeKeys = [];
    this._handleNavigationKey = (event) => {
      if (!this.calendar || event.defaultPrevented || event.altKey || event.ctrlKey ||
          event.metaKey || event.shiftKey || !["F15", "F16"].includes(event.key)) return;
      if (this.renderRoot.querySelector("dialog[open]") || event.composedPath().some((element) =>
        element instanceof HTMLElement && (element.isContentEditable ||
          element.matches("input, textarea, select, dialog[open], [role='textbox']")))) return;
      event.preventDefault();
      if (event.key === "F15") this.calendar.prev();
      else this.calendar.next();
    };
    this._scheduleHeightUpdate = () => {
      if (this._heightFrame !== undefined) return;
      this._heightFrame = requestAnimationFrame(() => {
        this._heightFrame = undefined;
        if (!this._config?.fillHeight || !this.isConnected) return;
        const viewport = window.visualViewport;
        const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
        const bounds = this.getBoundingClientRect();
        const top = Math.max(viewport?.offsetTop || 0, bounds.top);
        const layoutHeight = Number.parseFloat(getComputedStyle(this).height);
        const scale = layoutHeight > 0 && bounds.height > 0 ? bounds.height / layoutHeight : 1;
        const height = `${Math.max(0, Math.floor((bottom - top) / scale))}px`;
        if (this.style.getPropertyValue("--calendar-available-height") !== height) {
          this.style.setProperty("--calendar-available-height", height);
        }
      });
    };
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._hiddenCalendars = new Set();
    this._sourceRequests.clear();
    this._sourceSnapshots.clear();
    this._pollRequest = undefined;
    this._pollAgain = false;
    this._savedView = undefined;
    this._savedDate = undefined;
    this.renderRoot?.querySelector("dialog")?.close();
    this.toggleAttribute("fill-height", this._config.fillHeight);
    this.toggleAttribute("time-based-layout", this._config.timeBasedLayout);
  }

  set hass(value) { this._hass = value; }
  get hass() { return this._hass; }
  getCardSize() { return 8; }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
    this._heightObserver = new ResizeObserver(this._scheduleHeightUpdate);
    // Observe containing layouts too: HA can move the card when its header or
    // sidebar changes without resizing the browser window.
    for (let element = this; element; element = element.parentElement || element.getRootNode().host) {
      this._heightObserver.observe(element, { box: "border-box" });
    }
    window.addEventListener("resize", this._scheduleHeightUpdate);
    window.addEventListener("keydown", this._handleNavigationKey);
    window.addEventListener("scroll", this._scheduleHeightUpdate, true);
    window.visualViewport?.addEventListener("resize", this._scheduleHeightUpdate);
    window.visualViewport?.addEventListener("scroll", this._scheduleHeightUpdate);
    this._scheduleHeightUpdate();
    // Calendar entities may change future events without changing their current state.
    this._refreshTimer = setInterval(() => {
      if (!document.hidden) this._refreshChangedEvents();
    }, 60000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._refreshTimer);
    this._heightObserver?.disconnect();
    window.removeEventListener("resize", this._scheduleHeightUpdate);
    window.removeEventListener("keydown", this._handleNavigationKey);
    window.removeEventListener("scroll", this._scheduleHeightUpdate, true);
    window.visualViewport?.removeEventListener("resize", this._scheduleHeightUpdate);
    window.visualViewport?.removeEventListener("scroll", this._scheduleHeightUpdate);
    cancelAnimationFrame(this._heightFrame);
    this._heightFrame = undefined;
    this._savedView = this.calendar?.view.type;
    this._savedDate = this.calendar?.getDate();
    this._timeLayout?.destroy();
    this._timeLayout = undefined;
    this.calendar?.destroy();
    this.calendar = undefined;
    this._sourceRequests.clear();
    this._sourceSnapshots.clear();
    this._pollRequest = undefined;
    this._pollAgain = false;
    this._selectedEvent = undefined;
  }

  updated(changed) {
    if (!this._config || !this._hass || !this.isConnected) return;
    const preferences = resolvePreferences(this._config, this._hass);
    const preferencesChanged = JSON.stringify(preferences) !== JSON.stringify(this._preferences);
    this._preferences = preferences;
    if (changed.has("_config") && this.calendar) {
      this._timeLayout?.destroy();
      this._timeLayout = undefined;
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
        this.calendar.setOption("weekNumberCalculation", createWeekNumberCalculation(this._config.weekNumberCalculation, preferences.timeZone));
        this.calendar.setOption("eventTimeFormat", eventTimeFormat(preferences.hour12));
      });
    }
    if (changed.has("_hass") || changed.has("_config")) {
      const oldHass = changed.get("_hass");
      if (oldHass && this._config.entities.some(({ entity }) => oldHass.states?.[entity] !== this._hass.states?.[entity])) {
        this._refreshChangedEvents();
      }
      this._applyTheme();
    }
    // Cap the host at the viewport bottom. FullCalendar's own ResizeObserver
    // then resizes the grid without rebuilding it or changing navigation.
    this._scheduleHeightUpdate();
    this._timeLayout?.schedule();
  }

  async _refreshChangedEvents() {
    if (!this.calendar || !this._config || !this._hass) return;
    if (this._pollRequest) {
      this._pollAgain = true;
      return;
    }
    const request = Symbol();
    this._pollRequest = request;
    const calendar = this.calendar;
    const config = this._config;
    const hass = this._hass;
    const targets = [...this._sourceSnapshots].filter(([index, snapshot]) =>
      !this._hiddenCalendars.has(index) && this._sourceRequests.get(index) === snapshot.request);
    try {
      const results = await Promise.all(targets.map(async ([index, snapshot]) => {
        try {
          const events = await this._service.getEvents(hass, config.entities[index], snapshot.start, snapshot.end);
          return { index, snapshot, signature: eventSignature(events) };
        } catch (error) {
          return { index, snapshot, error };
        }
      }));
      if (!this.isConnected || this.calendar !== calendar || this._config !== config) return;
      // If a state changed before its initial source load completed, retry it
      // as the old direct refetch path did.
      const changed = config.entities.flatMap((_, index) =>
        !this._hiddenCalendars.has(index) && !this._sourceSnapshots.has(index) ? [index] : []);
      for (const { index, snapshot, signature, error } of results) {
        if (this._hiddenCalendars.has(index) || this._sourceSnapshots.get(index) !== snapshot ||
            this._sourceRequests.get(index) !== snapshot.request) continue;
        if (error) {
          this._errors = new Map(this._errors).set(index, {
            name: calendarName(this._hass, config.entities[index]), reason: error.message,
          });
        } else {
          if (this._errors.has(index)) {
            this._errors = new Map(this._errors);
            this._errors.delete(index);
          }
          if (signature !== snapshot.signature) changed.push(index);
        }
      }
      // FullCalendar replaces a source's event elements even when its data is
      // identical. Avoid that redraw (and the visible time-layout jump).
      calendar.batchRendering(() => {
        for (const index of changed) {
          calendar.getEventSourceById(`${config.entities[index].entity}-${index}`)?.refetch();
        }
      });
    } finally {
      if (this._pollRequest === request) {
        this._pollRequest = undefined;
        if (this._pollAgain) {
          this._pollAgain = false;
          this._refreshChangedEvents();
        }
      }
    }
  }

  _createCalendar() {
    const config = this._config;
    const preferences = this._preferences;
    this._sourceRequests.clear();
    this._sourceSnapshots.clear();
    this.calendar = new Calendar(this.renderRoot.querySelector("#calendar"), {
      plugins: [classicTheme, dayGridPlugin, listPlugin, multiMonthPlugin],
      locales,
      locale: preferences.language,
      firstDay: preferences.firstDay,
      timeZone: preferences.timeZone,
      // Render through public content hooks so numbers also appear in narrow cells.
      weekNumbers: false,
      weekNumberCalculation: createWeekNumberCalculation(config.weekNumberCalculation, preferences.timeZone),
      initialView: this._savedView || config.initialView,
      ...(this._savedDate ? { initialDate: this._savedDate } : {}),
      headerToolbar: false,
      height: config.fillHeight ? "100%" : "auto",
      views: {
        dayGridMonth: { fixedWeekCount: false },
        dayGridTwoWeeks: {
          type: "dayGrid", duration: { weeks: 2 },
          dateIncrement: { weeks: 2 }, dateAlignment: "week",
          titleFormat: { year: "numeric", month: "short", day: "numeric" },
        },
        multiMonthTwo: {
          viewClass: "family-month-view",
          type: "multiMonth", duration: { months: 2 },
          dateIncrement: { months: 1 }, dateAlignment: "month",
          fixedWeekCount: false,
        },
        list: { type: "list", duration: { weeks: 1 } },
      },
      multiMonthMaxColumns: config.twoMonthLayout === "horizontal" ? 2 : 1,
      // Keep the explicitly chosen layout even when the containing card narrows.
      singleMonthMinWidth: 1,
      singleMonthTitleFormat: { month: "long", year: "numeric" },
      // Disable FullCalendar's own narrow-day event collapse as well as the old card breakpoint.
      dayNarrowWidth: 0,
      eventDisplay: "block",
      ...(config.timeBasedLayout ? { eventOrder: timeBasedEventOrder, eventOrderStrict: true } : {}),
      eventInteractive: true,
      displayEventEnd: config.displayEventEnd,
      eventTimeFormat: eventTimeFormat(preferences.hour12),
      dayMaxEvents: config.fillHeight ? true : 5,
      moreLinkClick: "popover",
      eventClass: "family-event",
      eventInnerClass: "family-event-inner",
      dayHeaderClass: "family-day-header",
      dayCellClass: ({ isOther, inPopover, view }) =>
        `family-day-cell${isOther && !inPopover && ["dayGridMonth", "multiMonthTwo"].includes(view.type)
          ? " family-other-month" : ""}`,
      dayCellTopClass: "family-day-heading",
      dayCellTopInnerClass: "family-day-top",
      listDayBodyClass: "family-list-day-body",
      dayCellTopContent: (info) => {
        if (!config.weekNumbers || info.inPopover || info.dow !== this._preferences.firstDay ||
            !["dayGridTwoWeeks", "dayGridMonth", "multiMonthTwo"].includes(info.view.type)) return info.text;
        const week = document.createElement("span");
        week.className = "family-week-number";
        week.textContent = this.calendar.formatDate(info.date, { week: "narrow" });
        week.title = this.calendar.formatDate(info.date, { week: "long" });
        const day = document.createElement("span");
        day.className = "family-day-number";
        day.textContent = info.text;
        return { domNodes: [week, day] };
      },
      singleMonthClass: ({ multiMonthColumns }) =>
        `family-month${multiMonthColumns === 2 ? " family-month-horizontal" : ""}`,
      tableClass: ({ multiMonthColumns }) => multiMonthColumns ? "family-month-table" : "",
      tableHeaderClass: ({ multiMonthColumns }) => multiMonthColumns ? "family-month-table-header" : "",
      singleMonthHeaderClass: "family-month-header",
      tableBodyClass: ({ multiMonthColumns }) => multiMonthColumns
        ? `family-month-body${multiMonthColumns === 2 ? " family-month-body-horizontal" : ""}` : "",
      moreLinkClass: "family-more-link",
      moreLinkInnerClass: "family-more-link-inner",
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
        if (config.timeBasedLayout) {
          const placement = eventTimePlacement(info.event);
          title.dataset.timeBand = placement.band;
          title.dataset.startMinute = placement.minute;
        }
        nodes.push(title);
        return { domNodes: nodes };
      },
      eventClick: (info) => this._openEvent(info.event),
      datesSet: ({ view }) => {
        this._title = view.title;
        this._activeView = view.type;
        // FullCalendar omits inline week numbers when DayGrid has only one row.
        this._weekTitle = this.calendar.formatDate(view.currentStart, { week: "long" });
      },
      eventSources: config.entities.map((entity, index) => ({
        id: `${entity.entity}-${index}`,
        color: entity.eventColor,
        events: async ({ start, end }) => {
          const request = Symbol();
          this._sourceRequests.set(index, request);
          if (this._hiddenCalendars.has(index)) return [];
          // Ignore requests superseded by toggles, navigation, or a rebuilt calendar.
          const isCurrent = () => this._config === config &&
            this._sourceRequests.get(index) === request && !this._hiddenCalendars.has(index);
          try {
            const events = await this._service.getEvents(this._hass, entity, start, end);
            if (!isCurrent()) return [];
            this._sourceSnapshots.set(index, { start, end, signature: eventSignature(events), request });
            if (this._errors.has(index)) {
              this._errors = new Map(this._errors);
              this._errors.delete(index);
            }
            return events;
          } catch (error) {
            if (isCurrent()) {
              this._sourceSnapshots.set(index, { start, end, signature: eventSignature([]), request });
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
    if (config.timeBasedLayout) this._timeLayout = new TimeBasedLayout(this.renderRoot.querySelector("#calendar"));
  }

  _toggleCalendar(index) {
    const sourceId = `${this._config.entities[index].entity}-${index}`;
    const hidden = new Set(this._hiddenCalendars);
    if (hidden.has(index)) hidden.delete(index);
    else hidden.add(index);
    this._hiddenCalendars = hidden;
    this._errors = new Map(this._errors);
    this._errors.delete(index);
    this._sourceRequests.delete(index);
    this._sourceSnapshots.delete(index);
    if (hidden.has(index) && this._selectedEvent?.source?.id === sourceId) {
      this.renderRoot.querySelector("dialog")?.close();
    }
    this.calendar?.getEventSourceById(sourceId)?.refetch();
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

  _navigationButton(label, path, action, shortcut) {
    return customElements.get("ha-icon-button")
      ? html`<ha-icon-button .path=${path} .label=${label} aria-keyshortcuts=${shortcut} @click=${action}></ha-icon-button>`
      : html`<button type="button" class="icon-button" aria-label=${label} aria-keyshortcuts=${shortcut} @click=${action}>
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
            ${this._navigationButton(labels.previous, previousPath, () => this.calendar?.prev(), "F15")}
            ${this._button(labels.today, () => this.calendar?.today())}
            ${this._navigationButton(labels.next, nextPath, () => this.calendar?.next(), "F16")}
          </div>
          <h2 aria-live="polite">${this._title || labels.calendar}
            ${this._config.weekNumbers && this._activeView === "dayGridWeek"
              ? html`<span class="family-week-number-header">${this._weekTitle}</span>` : nothing}
          </h2>
          <div class="views" role="group" aria-label=${labels.view}>
            ${this._config.views.map((view) => this._button(labels[view],
              () => this.calendar?.changeView(view), this._activeView === view))}
          </div>
        </header>
        <div class="calendars" role="group" aria-label=${labels.calendars}>
          ${this._config.entities.map((entity, index) =>
            // Native buttons expose aria-pressed directly on the focusable control.
            html`<button type="button" aria-pressed=${String(!this._hiddenCalendars.has(index))}
              @click=${() => this._toggleCalendar(index)}>
              <span class="calendar-color" style=${styleMap({ backgroundColor: entity.eventColor })} aria-hidden="true"></span>
              <span class="calendar-check" aria-hidden="true">${this._hiddenCalendars.has(index) ? "" : "✓"}</span>
              <span class="calendar-name">${calendarName(this._hass, entity)}</span>
            </button>`)}
        </div>
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
