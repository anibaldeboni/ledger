import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const dark = styles.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

for (const [token, value] of [
  ["--background", "#0b0e16"],
  ["--primary", "#f5a524"],
  ["--primary-foreground", "#241700"],
  ["--muted-foreground", "#8b93a9"],
  ["--border", "#262e45"],
  ["--destructive", "#e5484d"],
]) {
  assert.ok(dark.includes(`${token}: ${value}`), `.dark must preserve ${token}=${value}`);
}

const config = JSON.parse(readFileSync(new URL("../../components.json", import.meta.url), "utf8"));
assert.match(html, /<html[^>]*class="dark"/);
assert.equal(config.style, "radix-nova");
assert.equal(config.iconLibrary, "lucide");
assert.match(styles, /--font:\s*"Geist Variable"/);
assert.match(styles, /@font-face\s*{[^}]*Inter-Medium\.ttf/);
assert.doesNotMatch(
  styles.replace(/@theme inline\s*\{[\s\S]*?\n\}/, ""),
  /var\(--(?:accent|muted)\)/,
  "legacy styles must use semantic brand and text tokens",
);

console.log("shadcn theme foundation invariants passed");
