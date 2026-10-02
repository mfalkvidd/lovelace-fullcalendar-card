# FullCalendar card for Home Assistant

A family calendar dashboard that combines Home Assistant calendar entities, including Google Calendar entities, into one calendar. Each calendar keeps its own color. Day, Week, Month, and optional two-week and two-month views retain their selected layout at every card width.

Targets **Home Assistant 2026.1 and later** with current Firefox and Chromium browsers. The source uses Lit 3, FullCalendar 7, and esbuild. The distributed JavaScript includes its dependencies and styles; no CDN is needed.

## Installation

### HACS

1. Install from a GitHub release that includes `lovelace-fullcalendar-card.js`. Open HACS and search for **Lovelace FullCalendar Card**. If it is not listed, add `https://github.com/gadgetchnnel/lovelace-fullcalendar-card` under **Custom repositories**, choosing **Dashboard** as the type.
2. Download the card and reload the browser.
3. Check **Settings → Dashboards → Resources** (enable Advanced Mode in your profile if needed). The resource should be `/hacsfiles/lovelace-fullcalendar-card/lovelace-fullcalendar-card.js`, type **JavaScript module**. Add it only if HACS has not registered it.
4. Add a Manual card using one of the configurations below.

For dashboards whose resources are managed in YAML, add this to the `lovelace:` configuration:

```yaml
resources:
  - url: /hacsfiles/lovelace-fullcalendar-card/lovelace-fullcalendar-card.js
    type: module
```

The generated bundle is not stored in Git. HACS installs the `lovelace-fullcalendar-card.js` asset from a GitHub release; a release with that asset must exist before installing through HACS. The default branch contains source code only.

### Manual installation

Download `lovelace-fullcalendar-card.js` from a GitHub release, or run `npm ci && npm run build` from a source checkout. Copy the bundle to `/config/www/` and register `/local/lovelace-fullcalendar-card.js` as a JavaScript module resource. After replacing the file, change the version query on the existing resource URL (for example `/local/lovelace-fullcalendar-card.js?v=2`) and reload the dashboard so the browser loads the new bundle. Do not add a second resource entry or load both the manual and HACS resources.

## Basic calendar

```yaml
type: custom:fullcalendar-card
entities:
  - entity: calendar.home_calendar
    eventColor: green
```

Configure Google Calendar in Home Assistant first, then use its `calendar.*` entities here. The card reads HA's calendar API; it does not need Google credentials.

To spread events through each day by start time, add `timeBasedLayout: true` to the card configuration. See [Time-based day layout](#time-based-day-layout) for the full example and placement rules.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `type` | Required by HA | `custom:fullcalendar-card` |
| `entities` | Required | Non-empty array of entity IDs or entity objects (see below). |
| `views` | `[dayGridDay, dayGridWeek, dayGridMonth]` | Available view types, in selector order. Supported: `dayGridDay`, `dayGridWeek`, `dayGridTwoWeeks`, `dayGridMonth`, `multiMonthTwo`, `list`. |
| `initialView` | `dayGridMonth` | Initial view. If Month is absent from `views`, defaults to the first configured view. An explicit value must be in `views`. |
| `twoMonthLayout` | `vertical` | Layout inside the Two months view: `vertical` stacks the months; `horizontal` puts them side by side in one card with shared controls. |
| `firstDay` | `auto` | `0` Sunday, `1` Monday, `2` Tuesday, `3` Wednesday, `4` Thursday, `5` Friday, `6` Saturday, or `auto`. |
| `weekNumbers` | `true` | Show week numbers in Week, Two weeks, Month, and Two months. Day and List never show them. |
| `weekNumberCalculation` | `ISO` | Numbering method: `ISO`, `US`, or `local`. See [Week numbers](#week-numbers). Values are case-sensitive. |
| `displayEventEnd` | `true` | Show the end as well as the start of timed events. An event must have an end time. |
| `hour12` | `auto` | `false` for 24-hour time, `true` for 12-hour time, or `auto`. |
| `timeBasedLayout` | `false` | Place events within each day by start time, with all-day/multi-day events first, early events at the top and late events at the bottom. See [Time-based day layout](#time-based-day-layout). |
| `fillHeight` | `false` | Fill the available height, capped at the bottom of the screen. Intended for a Panel view. Month grids resize to fit the selected layout. |
| `theme` | Inherited HA theme | Optional name of a Home Assistant theme, including its active light/dark mode. |

Automatic first weekday uses `hass.locale.first_weekday` when configured; otherwise it uses the HA language's locale week data, with a CLDR fallback for browsers without `Intl.Locale` week information. An explicit YAML weekday always wins, including `firstDay: 0`.

Automatic time format follows HA's profile setting: explicit 12/24-hour preference, language preference, or browser system preference. The same choice applies to every view and event details. HA's local/server time-zone preference is also respected. Date labels follow the HA language; time-range punctuation follows locale conventions.

Controls follow the HA language too, including live language changes. Standard labels use FullCalendar's bundled translations. Card-specific labels (such as Two weeks, Two months, Location, and calendar loading errors) support English and Swedish, with English as the fallback for other languages. Swedish (`sv`, including `sv-SE`) shows **Idag | Dag | Vecka | Två veckor | Månad | Två månader** when all these views are configured, with **Plats** and **Stäng** in event details. No extra locale download or YAML setting is needed.

Invalid values fail early with a configuration message; for example, `firstDay: 9`, `initialView: doesNotExist`, and `views: dayGridMonth` are invalid. Use real YAML booleans, not quoted strings.

### Entity options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | Required | Calendar or other HA entity ID. A string entry is shorthand for this field. |
| `name` | Entity friendly name, then ID | Calendar name in details; event title for non-calendar entities. |
| `eventColor` | `#3788d8` | CSS color for this entity's events; quote hexadecimal colors in YAML. |
| `time_list_attribute` | None | For non-calendar entities, an attribute containing an array of date/time strings. |

Calendar event titles come from the events, not the entity's `name`. Calendar failures are shown in the card; other calendars can still load. Events refresh on navigation and relevant entity changes. While the page is visible, the card checks each minute for changes and redraws only calendars whose events changed. Upstream Google Calendar synchronization still depends on the HA integration.

## Show or hide calendars

A row of calendar toggles appears above the grid automatically. Each uses its configured `name` (or HA friendly name) and `eventColor`. A checkmark marks a visible calendar; hidden calendars have a crossed-out name. Click or use the keyboard to turn each calendar on or off, including hiding all calendars.

The selection applies to every view and survives navigation, preference changes, refreshes of events, and reconnecting the card. Hidden calendars make no event API requests; showing one again loads its latest events. This is a display filter for this card. All calendars start visible again after a browser reload or editing the card configuration. No additional YAML is needed. The controls are grouped under **Calendars** / **Kalendrar** for screen readers.

## Monday-first week and start/end times

```yaml
type: custom:fullcalendar-card
initialView: dayGridWeek
firstDay: 1
hour12: false
displayEventEnd: true
entities:
  - calendar.home_calendar
```

Week always means seven `dayGridWeek` columns, including on portrait displays. A timed event shows a range such as `14:30–16:00 Simskola`; all-day events show only their title. Details always include full start/end dates and times when available, even with `displayEventEnd: false`.

## Week numbers

Week numbers are shown by default in Week (`dayGridWeek`), Two weeks (`dayGridTwoWeeks`), Month (`dayGridMonth`), and Two months (`multiMonthTwo`). In Week, the number appears below the date heading; the other views show a number at each week's row, including rows crossing a month or year boundary. Day and List do not show week numbers.

Choose the calculation with `weekNumberCalculation`:

| Value | Numbering rules | Suggested grid setting |
| --- | --- | --- |
| `ISO` (default) | ISO 8601: Monday starts the week; week 1 contains January 4 (the year's first Thursday). Early January can belong to week 52 or 53 of the previous week-year. | `firstDay: 1` |
| `US` | Sunday starts the week; week 1 contains January 1. Late December can belong to week 1 of the following week-year. This is not the zero-based `%U` system. | `firstDay: 0` |
| `local` | FullCalendar's rules for the HA language, together with the effective `firstDay`. For example, Swedish with Monday first uses ISO-style numbering. Changing the HA language or first weekday updates the numbers. | `firstDay: auto` |

`ISO` and `US` are explicit numbering systems, independent of the interface language and `firstDay`. `firstDay` still controls the grid's column order, including HA's profile preference when set to `auto`. The number on a row describes its **first date**. If the grid starts on a different weekday from the numbering system, the row can span two numbered weeks; use the matching settings above for the usual layout. Calculations use the calendar's selected time zone.

For Swedish/ISO weeks, even with HA set to English:

```yaml
type: custom:fullcalendar-card
entities:
  - calendar.home_calendar
views: [dayGridDay, dayGridWeek, dayGridTwoWeeks, dayGridMonth, multiMonthTwo]
initialView: dayGridTwoWeeks
weekNumbers: true
weekNumberCalculation: ISO
firstDay: 1
```

For US numbering, change these two settings:

```yaml
weekNumberCalculation: US
firstDay: 0
```

To follow the HA language and weekday preference:

```yaml
weekNumberCalculation: local
firstDay: auto
```

To hide week numbers in all views, set `weekNumbers: false`. For example, January 1, 2021 is ISO week **53**, but US week **1**. January 4 is ISO week **1**, but US week **2**. These boundary cases are covered by the tests.

The card uses FullCalendar's week-number formatting and [local calculation](https://fullcalendar.io/docs/weekNumberCalculation), with separate ISO/US calculations to keep those explicit rules independent of the grid's first weekday. Numbers remain visible on narrow screens.

## Time-based day layout

Enable this optional layout with:

```yaml
type: custom:fullcalendar-card
timeBasedLayout: true
fillHeight: true
entities:
  - calendar.family
```

In every view (Day, Week, Two weeks, Month, both Two months layouts, and List), each day is arranged as follows:

- All-day events and events spanning multiple calendar dates stay at the top, retaining their spanning bars in the grid views.
- Other events starting before **07:00** follow them, ordered by start time.
- Events starting after **18:00** sit at the bottom, ordered by start time.
- Events starting from **07:00 through 18:00**, inclusive, use the space between those groups. Their vertical centers follow their start times on that scale, with **12:30 at the midpoint** of the remaining space. Event blocks keep their normal text height; duration does not control block height.

Nearby or simultaneous events move just enough to avoid overlapping, while preserving start-time order. The layout uses the same time zone as the displayed event times. A timed event ending exactly at midnight belongs to the preceding day because calendar end times are exclusive.

Crowded days keep the existing event limits and **+N more** popups; all events remain available there. Placement applies to the visible events, and popups retain their usual compact list. List view keeps its existing scrolling and shows all events; quiet days have at least 320 pixels of space for positioning. Calendar filters, colors, event details, and shared navigation work as usual.

`timeBasedLayout` defaults to `false`. It also works without `fillHeight`, using the day cells' normal available space. Enable `fillHeight: true` for a wall display so the layout can use the screen height.

## Multiple calendars in a full-height panel

This is dashboard YAML. A Panel view contains one card:

```yaml
views:
  - title: Calendar
    path: calendar
    type: panel
    cards:
      - type: custom:fullcalendar-card
        initialView: dayGridMonth
        views:
          - dayGridDay
          - dayGridWeek
          - dayGridTwoWeeks
          - dayGridMonth
          - multiMonthTwo
        firstDay: 1
        displayEventEnd: true
        hour12: false
        fillHeight: true
        entities:
          - entity: calendar.person_1
            name: Person 1
            eventColor: "#4A90E2"
          - entity: calendar.person_2
            name: Person 2
            eventColor: "#E27D4A"
          - entity: calendar.person_3
            name: Person 3
            eventColor: "#72B572"
          - entity: calendar.person_4
            name: Person 4
            eventColor: "#B77AC4"
```

With `fillHeight: true`, the card fills its container up to the bottom of the visible screen, accounting for its position below HA's header. A smaller parent height is respected; an auto-height parent uses the remaining screen space. Container and viewport observers respond to header, sidebar, and size changes without changing the active view or date. Month grids include their headings and margins within that height, and busy days use `+N more` links. Omit `fillHeight` for normal cards, which grow with their content.

## Landscape: two months side by side in one card

Set `twoMonthLayout: horizontal` to show one complete month on the left and the next month on the right. Both grids belong to **one card and one calendar instance**: they share a single Previous/Today/Next toolbar, view selector, calendar filters, and event-details dialog.

Previous/Next shifts the pair by **one month**. For example, September–October becomes October–November with Next, and Previous returns to September–October. Today shows the current month and the following month. The same navigation applies to the vertical layout.

For a landscape display, this **dashboard YAML** uses a Panel view so the single card fills the available screen. Replace the entities with your own:

```yaml
views:
  - title: Calendar
    path: calendar
    type: panel
    cards:
      - type: custom:fullcalendar-card
        initialView: multiMonthTwo
        views: [dayGridDay, dayGridWeek, dayGridTwoWeeks, dayGridMonth, multiMonthTwo]
        twoMonthLayout: horizontal
        fillHeight: true
        firstDay: 1
        hour12: false
        entities:
          - entity: calendar.home_calendar
            eventColor: "#4A90E2"
          - entity: calendar.work_calendar
            eventColor: "#E27D4A"
```

For an existing card, add `twoMonthLayout: horizontal`, include `multiMonthTwo` in `views`, and select Two months or set `initialView: multiMonthTwo`. Use `fillHeight: true` to keep the card within the available screen height, such as in a Panel view. It gives each horizontal month the full available grid height. Busy days use `+N more` links; clicking an event in either month opens the same details dialog.

`twoMonthLayout: vertical` is the default and stacks the months. `horizontal` keeps two columns when resized. This setting affects only Two months; the Two weeks view still shows two rows of seven days in the same card. No additional card or layout plugin is needed.

Month and Two months show four, five, or six week rows as needed. Every row contains at least one day from its month. Partial first/last weeks still include dates from adjacent months. Those days have a translucent gray overlay to distinguish them from the displayed month; their events remain visible and clickable. For September 2026 with Monday first, the last row is September 28–October 4; there is no extra October 5–11 row.

## Two-week view

Add `dayGridTwoWeeks` to `views` to enable the **Two weeks** / **Två veckor** option:

```yaml
type: custom:fullcalendar-card
initialView: dayGridTwoWeeks
views: [dayGridDay, dayGridWeek, dayGridTwoWeeks, dayGridMonth, multiMonthTwo]
firstDay: auto
hour12: auto
entities:
  - calendar.home_calendar
  - calendar.work_calendar
```

Two consecutive weeks appear as two rows of seven days, starting on the configured first weekday. Previous/next moves by two weeks, and Today returns to the current week and the following week. The view keeps all fourteen days when resized and supports `fillHeight: true` in a Panel view. The default selector remains Day, Week, Month; include `dayGridTwoWeeks` explicitly to show the new option.

## Two-month view

```yaml
type: custom:fullcalendar-card
initialView: multiMonthTwo
views: [dayGridDay, dayGridWeek, dayGridMonth, multiMonthTwo]
firstDay: auto
hour12: auto
entities:
  - calendar.home_calendar
  - calendar.work_calendar
```

Two complete consecutive months use the selected `twoMonthLayout` (stacked vertically by default). Previous/next moves by one month, updating both grids together; Day, Week, and Month move by one day, week, and month respectively. Today returns to the current period. Without `fillHeight`, each month retains a large grid for readable text. With `fillHeight: true`, vertical months share the height and horizontal months each use the full grid height. Busy days use overflow links so the full-height month grids fit without a calendar scrollbar. See the [landscape example](#landscape-two-months-side-by-side-in-one-card) for two months beside each other with shared navigation.

## Non-calendar entities

Existing timestamp and date-list entities remain supported:

```yaml
type: custom:fullcalendar-card
entities:
  - entity: sensor.next_meeting
    name: Next meeting
    eventColor: orange
  - entity: sensor.bin_collection
    eventColor: grey
    time_list_attribute: bin_dates
```

A timestamp sensor uses its state as the date. Other entities use `attributes.last_changed`, falling back to the entity's `last_changed`. Date-list attributes create one event per valid date. These events remain all-day markers for compatibility; this is not a historical state query. Missing entities and unavailable timestamps produce no event.

## Migration and limitations

- Existing `entities`, `name`, `eventColor`, `time_list_attribute`, and `theme` configurations are preserved. The custom element and resource filename are unchanged.
- Two months now advances one month per Previous/Next click, so adjacent periods overlap (September–October → October–November).
- Month remains the initial view. The default selector order is now **Day | Week | Month**. Resizing never selects another view. Add `list` explicitly if you want the optional seven-day list.
- End times are now on by default; set `displayEventEnd: false` for start-only display. Automatic time formatting replaces the old forced 24-hour grid and inconsistent popup formatting.
- Calendar all-day ends remain exclusive. For example, September 17 through an exclusive September 20 spans September 17–19. Long timed events are no longer incorrectly classified as all-day.
- Tap/click an event for details, including calendar, date/time, description, and location. Escape or Close dismisses the dialog. Descriptions and locations are plain text, including any embedded HTML.
- Narrow cards wrap event text. Normal cards show up to five events per day before a `+N more` popup; full-height and multi-month views use space-based overflow. Tap the overflow link to access every event for that day. Extremely narrow displays still require wrapping and overflow.
- The calendar is read-only. Creating/editing events and a visual configuration editor are not included.
- Old `card-mod` rules targeting FullCalendar 5 or the old popup may need updating. Modern browser features, including `ResizeObserver`, CSS container queries, and native dialogs, are required.

## Development and validation

Node.js 22 or later:

```sh
npm ci
npm test
npm run build
npx playwright install chromium firefox
npm run test:browser
```

`npm run watch` rebuilds on source changes. Always generate `lovelace-fullcalendar-card.js` from `src/`; never patch it manually. The bundle is ignored by Git and stays in the checkout for previews and manual installation. Publishing a GitHub release triggers the release workflow to build and attach the JS asset that HACS downloads. HACS cannot install from the source-only default branch.

See [tests/README.md](tests/README.md) for the repeatable HA 2026.1.3 integration setup, browser matrix, and limits of validation.
