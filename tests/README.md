# Validation

## Unit and standalone browser tests

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium firefox
npm run test:browser
```

The standalone fixture runs the **production bundle** with a controlled `hass` object, four event sources, and no HA custom elements. This also exercises accessible native-button fallbacks. It does not impersonate the HA frontend. Tests run in Chromium and Firefox, in the Europe/Stockholm timezone, with landscape and portrait viewports and container-only size changes.

Coverage includes Day/Week/Month/Two months; navigation and Today; all configured weekday modes; HA and explicit 12/24-hour choices; start/end times; all-day exclusive ends; multi-day timed events; distinct source colors; overflow; event details; live preferences; reconnect; refresh/deletion; unavailable calendars; text escaping; and fixed seven-column Week views. Swedish and `sv-SE` checks cover every control (including List), accessible labels, event details, and live language changes with an open dialog or existing loading errors.

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

`HA_URL` enables tests against the actual dashboard and actual `ha-button`/SVG-path `ha-icon-button` controls. Without it, these integration tests are explicitly skipped. The YAML fixture includes a full-height Panel view with four differently colored calendars and a normal masonry card using the original minimal YAML. Tests check browser exceptions, event retrieval, all four navigation intervals, Today, controls, first-weekday overrides, resizing, and details, including Swedish labels on HA's own controls. The static fixture remains useful for precisely controlled locale, data, and error scenarios.

An isolated Python 3.13.2+ environment with `homeassistant==2026.1.3` can also run this configuration. It needs HA's integration requirements and system dependencies (including libturbojpeg). This is the method used during implementation, with frontend `20260107.2`.

## Recorded validation

On 2026-09-22, all **29 unit tests** and **48 browser tests** passed: 44 standalone checks and 4 actual Home Assistant integration checks. Chromium 153 and Firefox 155 were used against Home Assistant 2026.1.3 (frontend 20260107.2), as well as the standalone fixture. The production bundle was rebuilt with the localization changes, and `git diff --check` passed. Screenshots and traces are written under ignored `test-results/`; test-account data stays under ignored `.test-ha/`.

Google OAuth/synchronization and the HACS download UI are not exercised by these browser tests. HACS metadata points to the rebuilt root bundle. Future HA versions, physical wall displays, and older kiosk browser engines require their own validation.
