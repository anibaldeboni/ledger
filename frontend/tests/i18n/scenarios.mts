import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import i18next from "i18next";
import { brl } from "../../src/lib/format.ts";

const localeNames = ["pt-BR", "en", "es"] as const;
const catalogs = Object.fromEntries(
  localeNames.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(new URL(`../../src/i18n/locales/${locale}/translation.json`, import.meta.url), "utf8"),
    ),
  ]),
) as Record<(typeof localeNames)[number], Record<string, unknown>>;

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

const portugueseKeys = keys(catalogs["pt-BR"]).sort();
for (const locale of localeNames) {
  assert.deepEqual(keys(catalogs[locale]).sort(), portugueseKeys, `${locale} must translate every key`);
  assert.equal(JSON.stringify(catalogs[locale]).includes("R$"), false, `${locale} must use $ in currency labels`);
}

assert.equal((catalogs["pt-BR"].nav as Record<string, string>).quotes, "Orçamentos");
assert.equal((catalogs.en.nav as Record<string, string>).quotes, "Quotes");
assert.equal((catalogs.es.nav as Record<string, string>).quotes, "Presupuestos");

const translator = i18next.createInstance();
await translator.init({
  resources: Object.fromEntries(localeNames.map((locale) => [locale, { translation: catalogs[locale] }])),
  lng: "pt-BR",
  fallbackLng: "pt-BR",
});
for (const locale of localeNames) {
  await translator.changeLanguage(locale);
  assert.equal(translator.t("nav.quotes"), (catalogs[locale].nav as Record<string, string>).quotes);
}

for (const locale of localeNames) {
  const currency = brl(1234.5, locale);
  assert.ok(currency.includes("$"), `${locale} must display a dollar sign`);
  assert.equal(currency.includes("R$"), false, `${locale} must not display R$`);
}

console.log("i18n resources and currency formatting passed");
