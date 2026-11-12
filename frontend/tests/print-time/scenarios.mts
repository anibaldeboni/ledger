import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isValidPrintDuration } from "../../src/lib/print-time.ts";

const validDurations = ["2d6h55m", "1h57m", "2m", "35s", "1h 57m", "2D6H55M"];
for (const duration of validDurations) {
  assert.equal(isValidPrintDuration(duration), true, `${duration} should be valid`);
}

const invalidDurations = ["", "  ", "1h2h", "2m1h", "1h2", "1.5h", "-1h", "1x", "0s", "1h\u00a057m", "999999999999999999999d"];
for (const duration of invalidDurations) {
  assert.equal(isValidPrintDuration(duration), false, `${JSON.stringify(duration)} should be invalid`);
}

const quoteForm = readFileSync(new URL("../../src/pages/QuoteForm.tsx", import.meta.url), "utf8");
const ptTranslations = JSON.parse(
  readFileSync(new URL("../../src/i18n/locales/pt-BR/translation.json", import.meta.url), "utf8"),
);
assert.match(quoteForm, /isValidPrintDuration\(p\.time\)/, "the form should validate duration text");
assert.match(quoteForm, /title=\{t\("quoteForm\.printTimeHint"\)\}/, "the input should describe accepted durations");
assert.match(ptTranslations.quoteForm.printTimeHint, /2d6h55m.*1h57m.*2m.*35s/);
assert.match(quoteForm, /printTime:\s*p\.time/);

console.log("Print-time validation and form probes passed.");
