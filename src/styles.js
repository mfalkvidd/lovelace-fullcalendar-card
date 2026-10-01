import { css, unsafeCSS } from "lit";
import skeleton from "fullcalendar/skeleton.css";
import classic from "fullcalendar/themes/classic/theme.css";

export const styles = [unsafeCSS(skeleton), unsafeCSS(classic), css`
  :host {
    display: block;
    min-width: 0;
    color: var(--primary-text-color, #212121);
    --fc-classic-primary: var(--primary-color, #03a9f4);
    --fc-classic-primary-foreground: var(--text-primary-color, #fff);
    --fc-classic-event: var(--fc-classic-primary);
    --fc-classic-event-contrast: #fff;
    --fc-classic-background: var(--ha-card-background, var(--card-background-color, #fff));
    --fc-classic-foreground: var(--primary-text-color, #212121);
    --fc-classic-muted-foreground: var(--secondary-text-color, #727272);
    --fc-classic-faint-foreground: var(--secondary-text-color, #727272);
    --fc-classic-border: var(--divider-color, #ddd);
    --fc-classic-strong-border: var(--divider-color, #ddd);
    --fc-classic-faint: color-mix(in srgb, var(--primary-text-color, #000) 4%, transparent);
    --fc-classic-muted: color-mix(in srgb, var(--primary-text-color, #000) 8%, transparent);
    --fc-classic-strong: color-mix(in srgb, var(--primary-text-color, #000) 14%, transparent);
    --fc-classic-today: color-mix(in srgb, var(--primary-color, #03a9f4) 12%, transparent);
    --fc-classic-small-dot-width: 8px;
    --fc-classic-large-dot-width: 10px;
  }
  :host([fill-height]) {
    height: var(--calendar-available-height, 100dvh);
    max-height: 100%;
    min-height: 0;
    box-sizing: border-box;
  }
  ha-card {
    display: flex;
    flex-direction: column;
    padding: 12px;
    box-sizing: border-box;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    container-type: inline-size;
  }
  :host([fill-height]) ha-card { height: 100%; min-height: 0; }
  header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; padding-bottom: 12px; }
  h2 { font-size: 1.25rem; font-weight: 500; margin: 0; }
  header h2 { flex: 1; text-align: center; }
  header .family-week-number-header { display: block; font-size: 0.8em; color: var(--secondary-text-color, #727272); }
  .navigation, .views { display: flex; align-items: center; gap: 4px; }
  .views { flex-wrap: wrap; }
  .calendars { display: flex; flex-wrap: wrap; gap: 4px; padding-bottom: 12px; }
  .calendars > button { max-width: 100%; min-height: 32px; padding: 6px 12px; font-size: 14px; }
  .calendar-color { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; }
  .calendar-check { display: inline-block; width: 1em; margin-inline: 4px; }
  .calendar-name { white-space: normal; overflow-wrap: anywhere; }
  .calendars [aria-pressed="false"] .calendar-name { text-decoration: line-through; }
  button {
    font: inherit;
    color: var(--primary-color, #0276aa);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 20px;
    padding: 8px 12px;
    min-height: 40px;
    cursor: pointer;
  }
  button:hover, button[aria-pressed="true"] { background: var(--fc-classic-today); }
  button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); }
  .icon-button { display: inline-flex; padding: 8px; }
  svg { width: 24px; height: 24px; fill: currentColor; }
  .calendar-container { min-width: 0; }
  :host([fill-height]) .calendar-container { flex: 1; min-height: 0; overflow: hidden; container-type: size; }
  :host([fill-height]) #calendar { height: 100%; }
  #calendar { font-size: 14px; }
  .family-event { cursor: pointer; border-radius: 4px; }
  .family-event-inner { display: block; white-space: normal; overflow-wrap: anywhere; padding: 2px 3px; line-height: 1.35; }
  .event-time { font-weight: 600; margin-inline-end: 0.35em; }
  .event-title { white-space: normal; }
  .family-day-header { font-size: 0.85em; }
  .family-other-month { position: relative; }
  .family-other-month::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(128, 128, 128, 0.22);
    z-index: 6;
    pointer-events: none;
  }
  .family-day-top { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px 4px; width: 100%; box-sizing: border-box; }
  .family-week-number { margin-inline-end: auto; font-size: 0.85em; font-weight: 600; color: var(--secondary-text-color, #727272); }
  .family-day-number { margin-inline-start: auto; }
  .family-month-header { font-weight: 500; }
  .family-month-body { min-height: 600px; }
  /* The view's content box excludes its borders. Each month gets one or half
     of that height, including its margins; flex layout measures the headings. */
  :host([fill-height]) .family-month-view { container-type: size; }
  :host([fill-height]) .family-month {
    height: calc(50cqh - 32px);
    min-height: 0;
    margin: 16px;
    container: month / size;
  }
  :host([fill-height]) .family-month-horizontal { height: calc(100cqh - 32px); }
  :host([fill-height]) .family-month-header { padding-block: 2px; }
  :host([fill-height]) .family-month-header,
  :host([fill-height]) .family-month-table-header { flex-shrink: 0; }
  :host([fill-height]) .family-month-table,
  :host([fill-height]) .family-month-body { flex: 1; min-height: 0; }
  /* Hidden event measurement elements must not enlarge the scrollable area.
     FullCalendar keeps visible events in the grid and exposes the rest via +N. */
  :host([fill-height]) .family-month-body { height: 0; overflow: clip; }
  /* FullCalendar reserves overlapping space for sticky headings in stacked
     months. In a fitted grid the headings stay in normal flow instead. */
  :host([fill-height]) .family-month-header,
  :host([fill-height]) .family-month-table,
  :host([fill-height]) .family-month-table-header,
  :host([fill-height]) .family-month-body { margin-block: 0 !important; }
  :host([fill-height]) .family-month-header,
  :host([fill-height]) .family-month-table-header { position: static; }
  @container month (max-height: 250px) {
    /* Short stacked months keep dates and overflow links on the same line,
       leaving all weeks visible instead of enforcing a taller date row. */
    .family-day-top { margin-block: 0; padding-block: 0; gap: 1px; flex-wrap: nowrap; font-size: 12px; line-height: 1.2; }
    .family-more-link {
      position: absolute !important;
      z-index: 5;
      bottom: 0;
      inset-inline-start: 2px;
      max-width: calc(100% - 22px);
      font-size: 10px;
      line-height: 1.1;
    }
    .family-more-link-inner { font-size: inherit; line-height: inherit; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .family-day-cell:has(.family-week-number) .family-more-link { inset-inline-start: 25%; max-width: calc(75% - 22px); }
  }
  /* List keeps its usual scrolling/all-events behavior. A quiet day has room
     for time placement; a busy day still grows to contain its complete list. */
  :host([time-based-layout]) .family-list-day-body { min-height: 320px; }
  .family-overflow { max-width: min(420px, 90vw); }
  .errors { color: var(--error-color, #b00020); font-size: 0.9rem; }
  .errors p { margin: 0 0 8px; }
  dialog {
    color: var(--primary-text-color, #212121);
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border: 1px solid var(--divider-color, #ddd);
    border-radius: 16px;
    padding: 24px;
    width: min(480px, calc(100vw - 64px));
    max-height: calc(100dvh - 96px);
    overflow: auto;
    overflow-wrap: anywhere;
    box-shadow: 0 8px 32px #0004;
  }
  dialog::backdrop { background: #0006; }
  .event-calendar { color: var(--secondary-text-color, #727272); }
  .description { white-space: pre-wrap; }
  .dialog-actions { display: flex; justify-content: flex-end; }
  @container (max-width: 650px) {
    header { justify-content: center; gap: 8px; }
    header h2 { order: -1; flex-basis: 100%; }
    #calendar { font-size: 12px; }
    .family-event-inner { padding: 1px 2px; }
    .event-time { display: block; }
  }
`];
