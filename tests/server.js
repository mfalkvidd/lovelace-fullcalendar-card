import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const revision = Date.now().toString(36);
const files = new Map([
  ["/", "tests/fixtures/index.html"],
  ["/lovelace-fullcalendar-card.js", "lovelace-fullcalendar-card.js"],
  ["/fixture.js", "tests/fixtures/fixture.js"],
]);
createServer(async (request, response) => {
  const file = files.get(new URL(request.url, "http://localhost").pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.setHeader("Content-Type", file.endsWith(".html") ? "text/html" : "application/javascript");
  response.setHeader("Cache-Control", "no-store");
  let content = await readFile(file, "utf8");
  if (file.endsWith("index.html")) content = content.replace('src="/fixture.js"', `src="/fixture.js?v=${revision}"`);
  if (file.endsWith("fixture.js")) content = content.replace('import "/lovelace-fullcalendar-card.js"', `import "/lovelace-fullcalendar-card.js?v=${revision}"`);
  response.end(content);
}).listen(8085, "127.0.0.1");
