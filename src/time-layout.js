const DAY = 86400000;
const MORNING = 7 * 60;
const EVENING = 18 * 60;

// FullCalendar's public startStr/endStr contain dates and wall-clock times in
// the calendar's selected zone. Date-only events stay floating calendar dates.
export function eventTimePlacement(event) {
  const start = event.startStr || "";
  const end = event.endStr || "";
  let lastDate = end.slice(0, 10);
  if (end && /^T00:00(?::00(?:\.0+)?)?(?:Z|[+-]|$)/.test(end.slice(10))) {
    lastDate = new Date(Date.parse(`${lastDate}T00:00:00Z`) - 1).toISOString().slice(0, 10);
  }
  const minute = Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16)) + Number(start.slice(17, 19) || 0) / 60;
  const multiDay = Boolean(lastDate && lastDate > start.slice(0, 10));
  return { minute, band: event.allDay || multiDay ? "top" : minute < MORNING ? "early" : minute > EVENING ? "late" : "daytime" };
}

// eventOrder supplies millisecond values for FullCalendar's calendar wall
// dates, rather than zoned EventApi.start instances. Keep spanning bars first
// so native slicing, overflow selection, and popovers use the same order.
export function timeBasedEventOrder(a, b) {
  const top = (event) => event.allDay || Math.floor(event.start / DAY) < Math.floor((event.end - 1) / DAY);
  return Number(top(b)) - Number(top(a)) || a.start - b.start || String(a.title).localeCompare(String(b.title));
}

// Least-squares placement of ordered blocks, constrained to fit without
// overlap. Subtracting the occupied heights turns this into bounded isotonic
// regression, so collisions move events as little as possible in both directions.
export function spreadDaytimeEvents(items, top, bottom, gap = 2) {
  if (!items.length) return [];
  const occupied = items.reduce((sum, item) => sum + item.height, 0) + gap * (items.length - 1);
  const slack = Math.max(0, bottom - top - occupied);
  const prefixes = [];
  const pools = [];
  let prefix = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    prefixes.push(prefix);
    const fraction = Math.max(0, Math.min(1, (item.minute - MORNING) / (EVENING - MORNING)));
    const desired = fraction * (bottom - top) - item.height / 2 - prefix;
    pools.push({ first: i, last: i, sum: desired, count: 1 });
    while (pools.length > 1) {
      const right = pools.at(-1), left = pools.at(-2);
      if (left.sum / left.count <= right.sum / right.count) break;
      pools.splice(-2, 2, { first: left.first, last: right.last, sum: left.sum + right.sum, count: left.count + right.count });
    }
    prefix += item.height + gap;
  }
  const positions = [];
  for (const pool of pools) {
    const offset = Math.max(0, Math.min(slack, pool.sum / pool.count));
    for (let i = pool.first; i <= pool.last; i++) positions[i] = { item: items[i], top: top + prefixes[i] + offset };
  }
  return positions;
}

export function placeTimedEvents(items, top, bottom) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.minute - b.minute);
  const occupied = sorted.reduce((sum, item) => sum + item.height, 0);
  // Preserve native layout if a transient resize has not yet recomputed the
  // visible events. FullCalendar will choose its normal +N more limit next.
  if (occupied > bottom - top + 0.5) return null;
  const gap = Math.min(2, Math.max(0, (bottom - top - occupied) / Math.max(1, items.length - 1)));
  const early = sorted.filter((item) => item.minute < MORNING);
  const daytime = sorted.filter((item) => item.minute >= MORNING && item.minute <= EVENING);
  const late = sorted.filter((item) => item.minute > EVENING);
  const placed = [];
  let cursor = top;
  for (const item of early) {
    placed.push({ item, top: cursor });
    cursor += item.height + gap;
  }
  const lateTop = bottom - late.reduce((sum, item) => sum + item.height, 0) - gap * Math.max(0, late.length - 1);
  placed.push(...spreadDaytimeEvents(daytime, cursor, late.length ? lateTop - gap : bottom, gap));
  cursor = lateTop;
  for (const item of late) {
    placed.push({ item, top: cursor });
    cursor += item.height + gap;
  }
  return placed;
}

// Move only the visible native blocks. Their measured sizes, spanning bars,
// keyboard handlers, event limits and FullCalendar popovers remain intact.
export class TimeBasedLayout {
  constructor(root) {
    this.root = root;
    this.offsets = new Map();
    this.scale = 1;
    this.observed = new Set();
    this.schedule = () => {
      if (this.frame !== undefined) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = undefined;
        this.layout();
      });
    };
    this.resizeObserver = new ResizeObserver(this.schedule);
    this.mutationObserver = new MutationObserver((records) => {
      if (records.some(({ target, type, attributeName }) => {
        // Ignore our own translations, but recover if FullCalendar replaces
        // an event's style and removes its placement without remounting it.
        return !(type === "attributes" && attributeName === "style" &&
          target.matches(".family-event, .family-more-link") &&
          Math.abs(this.appliedOffset(target) - (this.offsets.get(target) || 0)) < 0.02);
      })) this.schedule();
    });
    this.mutationObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    this.schedule();
  }

  appliedOffset(element) {
    return this.offsets.has(element) ? Number.parseFloat(element.style.translate.split(/\s+/)[1]) || 0 : 0;
  }

  naturalRect(element) {
    const rect = element.getBoundingClientRect();
    const offset = this.appliedOffset(element);
    // DOM rectangles include ancestor scaling; CSS translations use unscaled
    // layout pixels. Keep vertical measurements in that same coordinate space.
    return { left: rect.left, right: rect.right, top: rect.top / this.scale - offset,
      bottom: rect.bottom / this.scale - offset, height: rect.height / this.scale };
  }

  move(element, top, naturalTop) {
    const offset = Math.round((top - naturalTop) * 100) / 100;
    const previous = this.appliedOffset(element);
    if (offset) this.offsets.set(element, offset);
    else this.offsets.delete(element);
    if (Math.abs(offset - previous) >= 0.02) element.style.translate = offset ? `0 ${offset}px` : "";
  }

  layout() {
    const layoutHeight = Number.parseFloat(getComputedStyle(this.root).height);
    const renderedHeight = this.root.getBoundingClientRect().height;
    this.scale = layoutHeight > 0 && renderedHeight > 0 ? renderedHeight / layoutHeight : 1;
    const cells = [...this.root.querySelectorAll(".family-day-cell[data-date], .family-list-day-body")]
      .filter((el) => !el.closest(".family-overflow"));
    const eventElements = [...this.root.querySelectorAll(".family-event")].filter((el) => !el.closest(".family-overflow"));
    const links = [...this.root.querySelectorAll(".family-more-link")].filter((el) => !el.closest(".family-overflow, [inert]"));
    const observed = new Set([this.root, ...cells, ...eventElements, ...links]);
    for (const el of this.observed) if (!observed.has(el)) this.resizeObserver.unobserve(el);
    for (const el of observed) if (!this.observed.has(el)) this.resizeObserver.observe(el);
    this.observed = observed;
    for (const [el] of this.offsets) if (!observed.has(el)) this.offsets.delete(el);
    const visible = (el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().height > 0;
    const events = eventElements.filter(visible).map((el) => {
      const metadata = el.querySelector(".event-title");
      return { el, ...this.naturalRect(el), band: metadata?.dataset.timeBand, minute: Number(metadata?.dataset.startMinute) };
    });
    // An existing event can become all-day/multi-day after an edit or a zone
    // change. Clear its former timed offset before reserving the top band.
    for (const event of events) if (event.band === "top") this.move(event.el, event.top, event.top);
    for (const cell of cells) {
      const bounds = this.naturalRect(cell);
      if (!bounds.height || bounds.right <= bounds.left) continue;
      const heading = cell.querySelector(".family-day-heading");
      let top = heading ? this.naturalRect(heading).bottom : bounds.top + 2;
      let bottom = bounds.bottom - 2;
      const inList = cell.classList.contains("family-list-day-body");
      // A spanning bar belongs to its starting cell in the DOM, but reserves
      // space in every day that it crosses (and in only its own month pane).
      for (const event of events) {
        if (event.band === "top" && event.left < bounds.right - 1 && event.right > bounds.left + 1 &&
            event.top >= bounds.top - 1 && event.top < bounds.bottom &&
            (!inList || cell.contains(event.el))) top = Math.max(top, event.bottom + 2);
      }
      const ownEvents = events.filter((event) => cell.contains(event.el) && event.band !== "top");
      const more = links.find((el) => cell.contains(el) && visible(el));
      const moreRect = more && this.naturalRect(more);
      if (more) bottom -= moreRect.height + 2;
      const positions = placeTimedEvents(ownEvents, top, bottom);
      if (positions) {
        for (const { item, top: y } of positions) this.move(item.el, y, item.top);
        if (more) this.move(more, bounds.bottom - 2 - moreRect.height, moreRect.top);
      } else {
        for (const item of ownEvents) this.move(item.el, item.top, item.top);
        if (more) this.move(more, moreRect.top, moreRect.top);
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    for (const [el] of this.offsets) el.style.translate = "";
    this.offsets.clear();
    this.observed.clear();
  }
}
