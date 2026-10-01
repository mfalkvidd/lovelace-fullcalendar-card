# Validation

## Unit and standalone browser tests

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium firefox
npm run test:browser
```

For an interactive preview, run `node tests/server.js` and open `http://localhost:8085/`. It opens a single card with two horizontal months and shared navigation. The server disables caching and refreshes the fixture and bundle module URLs on restart. `/?preview=default` opens the default Month configuration used by regression tests.

The standalone fixture runs the **production bundle** with a controlled `hass` object, four event sources, and no HA custom elements. This also exercises accessible native-button fallbacks. It does not impersonate the HA frontend. Tests run in Chromium and Firefox, in the Europe/Stockholm timezone, with landscape and portrait viewports and container-only size changes.

Coverage includes Day/Week/Two weeks/Month/Two months; navigation and Today; all configured weekday modes; HA and explicit 12/24-hour choices; start/end times; all-day exclusive ends; multi-day timed events; distinct source colors; overflow; event details; live preferences; reconnect; refresh/deletion; unavailable calendars; text escaping; and fixed seven-column Week views. Two-week checks also verify two rows of seven days in landscape and portrait, normal and full-height cards, and access to second-week events through overflow. Swedish and `sv-SE` checks cover every control (including List), accessible labels, event details, and live language changes with an open dialog or existing loading errors.

Calendar toggles are checked in every view, including List, with keyboard operation and all calendars hidden. Tests verify that hidden calendars make no API requests, remain hidden across navigation/preferences/reconnection, fetch fresh events when restored, and ignore stale responses or errors after toggling. HA integration checks also verify the accessible pressed state of the native toggle buttons alongside HA's navigation and view controls.

Week-number checks cover ISO, US, and locale-based rules across New Year in all four supported views, including narrow screens and both months of Two months. They also cover disabling numbers, keeping Day/List free of numbers, independent grid-weekday settings, live locale/weekday/time-zone changes, and rendering inside HA. Unit cases include week 53, leap years, daylight-saving changes, and extreme time-zone offsets.

The landscape fixture uses one card with `twoMonthLayout: horizontal`. It checks 1280×720, 1920×1080, 2560×1440, narrow screens, and container-only resizing with normal and full-height cards. It verifies a single toolbar and filter row, side-by-side month grids, natural four/five/six-week month ranges with Sunday or Monday first, week numbers, shared month-by-month navigation across New Year and Today, filters affecting both months, right-pane event details, overflow, and Swedish controls. These checks run against the production bundle in the standalone fixture.

## Actual Home Assistant 2026.1.3 frontend

Use a **fresh disposable instance**, not your household HA installation. The setup script creates a test account and four Local Calendar integrations, then inserts dated sample events. No Google account is needed to exercise the same HA calendar REST API.

Prepare the directory:

```sh
mkdir -p .test-ha/www
cp tests/fixtures/ha/configuration.yaml .test-ha/
cp tests/fixtures/ha/ui-lovelace.yaml .test-ha/
cp lovelace-fullcalendar-card.js .test-ha/www/
```

Run the official container in another terminal:

```sh
docker run --rm --name fullcalendar-ha \
  -p 127.0.0.1:8124:8124 \
  -v "$(pwd)/.test-ha:/config" \
  ghcr.io/home-assistant/home-assistant:2026.1.3
```

Once `http://127.0.0.1:8124/api/onboarding` responds, initialize and run:

```sh
node scripts/setup-ha-test.mjs
HA_URL=http://127.0.0.1:8124 npm run test:browser
```

The setup script refuses a partly or fully onboarded instance. It writes ignored `.test-ha/auth.json` with test authentication. Repeat the browser command without rerunning setup. After rebuilding, copy the new bundle to `.test-ha/www/` before running HA tests. Copy the file: HA's static server does not serve symlinks escaping `www`.

`HA_URL` enables tests against the actual dashboard and actual `ha-button`/SVG-path `ha-icon-button` controls. Without it, these integration tests are explicitly skipped. The YAML fixture includes a full-height Panel view with four differently colored calendars and a normal masonry card using the original minimal YAML. Tests check browser exceptions, event retrieval, all five navigation intervals, Today, controls, first-weekday overrides, resizing, and details, including Swedish labels on HA's own controls. The static fixture remains useful for precisely controlled locale, data, and error scenarios.

An isolated Python 3.13.2+ environment with `homeassistant==2026.1.3` can also run this configuration. It needs HA's integration requirements and system dependencies (including libturbojpeg). This is the method used during implementation, with frontend `20260107.2`.

## Recorded validation

On 2026-10-01, adjacent-month shading passed **14 existing month-layout browser checks** in Chromium and Firefox. Additional interactive checks verified the exact September/October 2026 boundary dates, light and dark themes, event clicks, overflow popovers, both Two months layouts, and the single Month view. Day, Week, and Two weeks remain unshaded. The production bundle was rebuilt and the installation ZIPs were checked byte for byte.

On 2026-10-01, removing forced six-week padding passed **84 standalone browser checks** in Chromium and Firefox. New regressions verify natural four/five/six-week ranges in Month and both Two months layouts with Sunday and Monday starts, including September 2026 ending on October 4 when Monday is first. The running localhost preview was also checked directly. The 4 actual HA integration checks were skipped because `HA_URL` was not set. The production bundle was rebuilt, installation ZIPs were checked byte for byte, and `git diff --check` passed.

On 2026-09-29, the single-card horizontal-month layout passed **44 unit tests** and **78 standalone browser checks** in Chromium and Firefox. The eight new layout checks cover shared navigation, both panes' filters and details, resizing, and normal/full-height layouts. All existing standalone checks passed with the new one-month navigation interval. The 4 actual HA integration checks were skipped because the disposable HA runtime was unavailable and `HA_URL` was not set. The production bundle and installation ZIP were rebuilt and checked byte for byte; `git diff --check` passed.

On 2026-09-25, week numbers were validated with **39 passing unit tests** and **74 browser checks**: 70 standalone checks and 4 actual Home Assistant integration checks. The full browser run passed 73 checks; one Chromium HA check completed its functional assertions but reported `Transition was skipped. New ViewTransition started`. That check passed unchanged on rerun. After the final layout adjustment, all 28 selected week-number, layout, and HA checks passed in Chromium and Firefox. The HA instance used version 2026.1.3 (frontend 20260107.2). The production bundle was rebuilt, the installation ZIP was checked against it byte for byte, and `git diff --check` passed. Screenshots and traces are written under ignored `test-results/`; test-account data stays under ignored `.test-ha/`.

Google OAuth/synchronization and the HACS download UI are not exercised by these browser tests. HACS metadata points to the rebuilt root bundle. Future HA versions, physical wall displays, and older kiosk browser engines require their own validation.
