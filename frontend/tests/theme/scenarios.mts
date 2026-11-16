import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const root = styles.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const theme = styles.match(/@theme inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

for (const [token, value] of [
  ["--background", "#f8fafc"],
  ["--foreground", "#1e293b"],
  ["--primary", "#2563eb"],
  ["--primary-foreground", "#ffffff"],
  ["--accent", "#e9eff8"],
  ["--accent-foreground", "#0b0e16"],
  ["--cta", "#ea580c"],
  ["--cta-foreground", "#0b0e16"],
  ["--muted-foreground", "#475569"],
  ["--border", "#e2e8f0"],
]) {
  assert.ok(root.includes(`${token}: ${value}`), `:root must define ${token}=${value}`);
  assert.ok(theme.includes(`--color-${token.slice(2)}: var(${token})`), `${token} must expose a Tailwind utility`);
}

const config = JSON.parse(readFileSync(new URL("../../components.json", import.meta.url), "utf8"));
assert.doesNotMatch(html, /<html[^>]*class="dark"/, "the redesigned light palette is the default");
assert.equal(config.style, "radix-nova");
assert.equal(config.iconLibrary, "lucide");
assert.match(styles, /@import "tailwindcss";/);
assert.match(styles, /@import "@fontsource-variable\/geist";/);
assert.doesNotMatch(styles, /Inter-Medium\.ttf/);
assert.match(app, /className="[^"]*\bbg-background\b[^"]*"/);
assert.match(app, /className="[^"]*\bgrid\b[^"]*"/);

for (const selector of ["app", "sidebar", "brand", "nav-item", "language-switcher", "content", "skip-link"]) {
  assert.doesNotMatch(styles, new RegExp(`\\.${selector}\\s*\\{`), `${selector} layout must use Tailwind in JSX`);
}

console.log("Tailwind-first application theme invariants passed");
