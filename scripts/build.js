import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/main.js"],
  outfile: "lovelace-fullcalendar-card.js",
  bundle: true,
  format: "esm",
  target: ["es2022"],
  minify: true,
  legalComments: "inline",
  loader: { ".css": "text" },
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
