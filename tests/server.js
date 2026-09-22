import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const files = new Map([
  ["/", "tests/fixtures/index.html"],
  ["/lovelace-fullcalendar-card.js", "lovelace-fullcalendar-card.js"],
  ["/fixture.js", "tests/fixtures/fixture.js"],
]);
createServer(async (request, response) => {
  const file = files.get(new URL(request.url, "http://localhost").pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.setHeader("Content-Type", file.endsWith(".html") ? "text/html" : "application/javascript");
  response.end(await readFile(file));
}).listen(8085, "127.0.0.1");
