import { LitElement, css, html, nothing } from "lit";

// Update the clock independently so ticking does not rerender the card or
// schedule calendar layout work.
class FullCalendarClock extends LitElement {
  static properties = {
    preferences: { attribute: false },
    _now: { state: true },
  };
  static styles = css`
    :host { display: inline-block; white-space: nowrap; font-variant-numeric: tabular-nums; }
  `;

  constructor() {
    super();
    this._tick = () => { this._now = new Date(); };
  }

  connectedCallback() {
    super.connectedCallback();
    this._tick();
    this._timer = setInterval(this._tick, 1000);
    document.addEventListener("visibilitychange", this._tick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timer);
    document.removeEventListener("visibilitychange", this._tick);
  }

  willUpdate(changed) {
    if (changed.has("preferences") && this.preferences) {
      const { language, hour12, timeZone } = this.preferences;
      this._formatter = new Intl.DateTimeFormat(language, {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12,
        ...(timeZone === "local" ? {} : { timeZone }),
      });
    }
  }

  render() {
    return this._formatter && this._now
      ? html`<time datetime=${this._now.toISOString()} aria-live="off">${this._formatter.format(this._now)}</time>`
      : nothing;
  }
}

if (!customElements.get("fullcalendar-clock")) customElements.define("fullcalendar-clock", FullCalendarClock);
