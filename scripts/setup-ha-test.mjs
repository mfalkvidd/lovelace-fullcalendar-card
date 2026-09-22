// Only run against a NEW, disposable Home Assistant instance. Writes test calendars/events.
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.HA_URL || "http://127.0.0.1:8124";
let token;
async function api(path, data, method = "POST") {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token.access_token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}
const onboarding = await api("onboarding", undefined, "GET");
if (onboarding.some((step) => step.done)) throw new Error("This script requires a fresh disposable HA instance.");
const { auth_code } = await api("onboarding/users", {
  client_id: `${base}/`, name: "Calendar test", username: "calendar-test",
  password: "disposable-calendar-test-only", language: "en",
});
const authResponse = await fetch(`${base}/auth/token`, {
  method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code: auth_code, client_id: `${base}/` }),
});
token = await authResponse.json();
await api("onboarding/core_config", {});
await api("onboarding/analytics", {});
await api("onboarding/integration", { client_id: `${base}/`, redirect_uri: `${base}/` });
for (let i = 1; i <= 4; i++) {
  const flow = await api("config/config_entries/flow", { handler: "local_calendar", show_advanced_options: false });
  const result = await api(`config/config_entries/flow/${flow.flow_id}`, { calendar_name: `Person ${i}` });
  if (result.type !== "create_entry") throw new Error(JSON.stringify(result));
}
// Wait for config entries to finish setting up.
for (let tries = 0; tries < 30; tries++) {
  const states = await api("states", undefined, "GET");
  if (states.filter((state) => /^calendar.person_[1-4]$/.test(state.entity_id)).length === 4) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
for (let i = 1; i <= 4; i++) {
  await api("services/calendar/create_event", {
    entity_id: `calendar.person_${i}`, summary: i === 1 ? "Simskola" : `Person ${i} appointment`,
    start_date_time: "2026-09-15T14:30:00+02:00", end_date_time: "2026-09-15T16:00:00+02:00",
    description: "Bring a towel", location: "Pool",
  });
}
await api("services/calendar/create_event", {
  entity_id: "calendar.person_1", summary: "Förskolan stängd", start_date: "2026-09-15", end_date: "2026-09-16",
});
await api("services/calendar/create_event", {
  entity_id: "calendar.person_1", summary: "Holiday", start_date: "2026-09-17", end_date: "2026-09-20",
});
await api("services/calendar/create_event", {
  entity_id: "calendar.person_1", summary: "Long timed trip",
  start_date_time: "2026-09-21T14:30:00+02:00", end_date_time: "2026-09-23T16:00:00+02:00",
});
for (let i = 0; i < 10; i++) {
  await api("services/calendar/create_event", {
    entity_id: "calendar.person_1", summary: `Busy ${i}`,
    start_date_time: `2026-09-25T${String(i + 8).padStart(2, "0")}:00:00+02:00`,
    end_date_time: `2026-09-25T${String(i + 9).padStart(2, "0")}:00:00+02:00`,
  });
}
await mkdir(".test-ha", { recursive: true });
await writeFile(".test-ha/auth.json", JSON.stringify({ ...token, hassUrl: base, clientId: `${base}/`, expires: Date.now() + token.expires_in * 1000 }), { mode: 0o600 });
console.log(`Prepared four local calendars in Home Assistant at ${base}.`);
