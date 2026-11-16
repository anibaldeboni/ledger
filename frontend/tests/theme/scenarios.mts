import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("../../src/components/ui/button.tsx", import.meta.url), "utf8");
const pages = [
  ["quotes", readFileSync(new URL("../../src/pages/Quotes.tsx", import.meta.url), "utf8")],
  ["quote form", readFileSync(new URL("../../src/pages/QuoteForm.tsx", import.meta.url), "utf8")],
  ["settings", readFileSync(new URL("../../src/pages/Settings.tsx", import.meta.url), "utf8")],
];
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
assert.match(styles, /@layer base\s*\{[\s\S]*?input,\s*select\s*\{\s*@apply[^}]*bg-background/);
assert.match(app, /className="[^"]*\bbg-background\b[^"]*"/);
assert.match(app, /className="[^"]*\bgrid\b[^"]*"/);

for (const selector of ["app", "sidebar", "brand", "nav-item", "language-switcher", "content", "skip-link"]) {
  assert.doesNotMatch(styles, new RegExp(`\\.${selector}\\s*\\{`), `${selector} layout must use Tailwind in JSX`);
}

const legacyClasses = new Set([
  "page-head", "quotes-head", "page-head-actions", "search-input", "btn",
  "btn-primary", "btn-danger", "btn-ghost", "btn-sm", "btn-icon", "th-sort",
  "error-text", "empty", "field", "row", "list", "list-row", "row-head",
  "cols-quote", "cols-printer", "cols-tariff", "cols-fil", "cols-cat", "money",
  "price", "muted", "actions", "grow", "plate-row", "plate-picker", "chip",
  "toolbar", "hint", "result", "result-line", "result-final", "invalid",
]);
for (const [page, source] of pages) {
  const classNames = [...source.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
    .map((match) => match[1] ?? match[2] ?? "")
    .join(" ")
    .replace(/[{}"'`$():?]/g, " ");
  const legacy = classNames.split(/\s+/).find((className) => legacyClasses.has(className));
  assert.equal(legacy, undefined, `${page} must use Tailwind and shared UI components`);
  assert.match(source, /PageHeader/, `${page} reuses the shared page-heading pattern`);
}

for (const [page, source] of pages) {
  assert.doesNotMatch(
    source,
    /style=\{\{\s*(?:margin|padding|justifySelf|flexBasis|gridTemplateColumns|alignItems|height|width)/,
    `${page} layout must use Tailwind rather than static inline styles`,
  );
}

for (const selector of [
  "quotes-head", "page-head-actions", "list", "list-row", "row-head",
  "cols-quote", "cols-printer", "cols-tariff", "cols-fil", "cols-cat",
  "price", "result", "result-line", "result-final", "plate-row",
  "plate-picker", "chip", "muted", "toolbar", "grow",
]) {
  assert.doesNotMatch(styles, new RegExp(`\\.${selector}\\s*\\{`), `${selector} styles must be migrated to Tailwind`);
}
assert.match(button, /cta:\s*"bg-cta text-cta-foreground/);

console.log("Tailwind-first application styling invariants passed");
