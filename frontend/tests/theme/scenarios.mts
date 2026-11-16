import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("../../src/components/ui/button.tsx", import.meta.url), "utf8");
const translationLocales = ["pt-BR", "en", "es"];
const pages = [
  ["quotes", readFileSync(new URL("../../src/pages/Quotes.tsx", import.meta.url), "utf8")],
  ["quote form", readFileSync(new URL("../../src/pages/QuoteForm.tsx", import.meta.url), "utf8")],
  ["settings", readFileSync(new URL("../../src/pages/Settings.tsx", import.meta.url), "utf8")],
];
const productionPages = [
  ["production board", readFileSync(new URL("../../src/pages/ProductionBoard.tsx", import.meta.url), "utf8")],
  ["production lane", readFileSync(new URL("../../src/pages/ProductionLane.tsx", import.meta.url), "utf8")],
  ["production stage manager", readFileSync(new URL("../../src/pages/ProductionStageManager.tsx", import.meta.url), "utf8")],
  ["production settings", readFileSync(new URL("../../src/pages/ProductionSettings.tsx", import.meta.url), "utf8")],
  ["production workspace", readFileSync(new URL("../../src/pages/ProductionWorkspace.tsx", import.meta.url), "utf8")],
  ["production archive", readFileSync(new URL("../../src/pages/ProductionArchive.tsx", import.meta.url), "utf8")],
  ["production reports", readFileSync(new URL("../../src/pages/ProductionReports.tsx", import.meta.url), "utf8")],
  ["production report order", readFileSync(new URL("../../src/pages/ProductionReportOrderCard.tsx", import.meta.url), "utf8")],
  ["production filament estimates", readFileSync(new URL("../../src/pages/ProductionFilamentEstimates.tsx", import.meta.url), "utf8")],
];
const root = styles.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const theme = styles.match(/@theme inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const dark = styles.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

assert.match(styles, /@custom-variant dark \(&:is\(\.dark \*\)\);/);
assert.match(dark, /color-scheme: dark;/);
assert.match(dark, /--background: #0b0e16;/);
assert.match(dark, /--foreground: #e8eaf2;/);

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
const themeStorageKey = app.match(/const THEME_STORAGE_KEY = "([^"]+)"/)?.[1];
assert.ok(themeStorageKey, "the app must define a persistent theme key");
assert.match(app, /localStorage\.getItem\(THEME_STORAGE_KEY\)/, "the app must restore the saved theme");
assert.match(app, /localStorage\.setItem\(THEME_STORAGE_KEY, nextTheme\)/, "the app must save theme changes");
assert.match(app, /classList\.toggle\("dark", nextTheme === "dark"\)/, "the selected theme must update the document root");
assert.match(
  app,
  /theme === "dark" \? <Sun aria-hidden="true" \/> : <Moon aria-hidden="true" \/>/,
  "the theme icon must indicate the available switch",
);
assert.match(
  app,
  /const themeAction = theme === "dark" \? "theme\.switchToLight" : "theme\.switchToDark"/,
  "the theme button label must describe the available switch",
);
assert.match(app, /aria-label=\{t\(themeAction\)\}/, "the theme button must expose its current action accessibly");
assert.match(app, /<span>\{t\(themeAction\)\}<\/span>/, "the theme button must display its current action");
assert.match(
  html,
  new RegExp(`localStorage\\.getItem\\(["']${themeStorageKey}["']\\)[\\s\\S]*?classList\\.add\\(["']dark["']\\)`),
  "the saved dark theme must be applied before the app renders",
);
assert.ok(
  html.indexOf("localStorage") < html.indexOf('src="/src/main.tsx"'),
  "the theme bootstrap must run before the React entry point",
);
for (const locale of translationLocales) {
  const translation = JSON.parse(
    readFileSync(new URL(`../../src/i18n/locales/${locale}/translation.json`, import.meta.url), "utf8"),
  );
  assert.equal(typeof translation.theme?.switchToDark, "string", `${locale} must label the dark theme action`);
  assert.equal(typeof translation.theme?.switchToLight, "string", `${locale} must label the light theme action`);
}
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

for (const [page, source] of productionPages) {
  const classNames = [...source.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
    .map((match) => match[1] ?? match[2] ?? "")
    .join(" ")
    .replace(/[{}"'`$():?]/g, " ");
  const legacy = classNames.split(/\s+/).find((className) => legacyClasses.has(className));
  assert.equal(legacy, undefined, `${page} must use Tailwind and shared UI components`);
  assert.doesNotMatch(classNames, /\bproduction-[a-z-]+\b/, `${page} must not depend on production-specific CSS selectors`);
  assert.doesNotMatch(source, /classList\.(?:add|remove)\("is-dragging"\)/, `${page} must express drag states with Tailwind-compatible attributes`);
}

assert.doesNotMatch(styles, /^\.production-[\w-]+/m, "production styling must be expressed in Tailwind classes");
for (const selector of [
  "page-head", "search-input", "btn", "btn-primary", "btn-danger", "btn-ghost",
  "btn-sm", "btn-icon", "field", "block", "row", "list", "list-row", "row-head",
  "money", "muted", "empty", "error-text", "ok-text", "hint", "actions",
  "toolbar", "grow",
]) {
  assert.doesNotMatch(
    styles,
    new RegExp(`\\.${selector}(?:\\s|\\{|:|\\.)`),
    `${selector} must not remain as a legacy stylesheet selector`,
  );
}
assert.doesNotMatch(styles, /--(?:bg|surface|surface-2|border-strong|accent-ink|danger|ok|font):/, "legacy style aliases must be removed");
assert.match(button, /cta:\s*"bg-cta text-cta-foreground/);

console.log("Tailwind-first application styling invariants passed");
