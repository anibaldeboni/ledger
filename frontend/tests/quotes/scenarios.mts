import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterByName } from "../../src/lib/search.ts";
import { marginPercentFromPrice } from "../../src/lib/quote-pricing.ts";

assert.equal(marginPercentFromPrice(75, 100), 25, "calculates margin from the sale price");
assert.equal(marginPercentFromPrice(125, 100), -25, "reports a loss when sale price is below cost");
assert.equal(marginPercentFromPrice(75, 0), null, "does not calculate a margin for a zero sale price");

const searchOrders = [
  { id: 1, title: "Pedido Café" },
  { id: 2, title: "Pedido Azul" },
];
assert.deepEqual(
  filterByName(searchOrders, " cafe ", (order) => order.title).map((order) => order.id),
  [1],
  "the order search ignores accents and surrounding whitespace",
);
assert.deepEqual(
  filterByName(searchOrders, "Pe", (order) => order.title),
  searchOrders,
  "searches shorter than three characters keep every order",
);

const quotePage = await readFile(new URL("../../src/pages/Quotes.tsx", import.meta.url), "utf8");
const quoteFormPage = await readFile(new URL("../../src/pages/QuoteForm.tsx", import.meta.url), "utf8");
assert.doesNotMatch(
  quoteFormPage,
  /className=(?:"[^"]*\b(?:page-head|block|row|field|plate-row|plate-picker|chip|result|result-line|result-final|btn|toolbar|hint|error-text|invalid)\b|\{[^}]*\b(?:page-head|block|row|field|plate-row|plate-picker|chip|result|result-line|result-final|btn|toolbar|hint|error-text|invalid)\b)/,
  "the quote form uses Tailwind utilities and shared components instead of legacy style classes",
);
assert.doesNotMatch(
  quoteFormPage,
  /style=\{\{\s*(?:margin|padding|justifySelf|flexBasis|gridTemplateColumns|alignItems|height|width)/,
  "the quote form uses Tailwind for layout rather than static inline styles",
);
assert.match(quoteFormPage, /quoteForm\.fields\.adjustedPrice/, "the quote result exposes an adjusted sale-price field");
assert.match(quoteFormPage, /marginPercentFromPrice\(result\.totalCost,\s*price\)/, "adjusting the sale price recalculates the displayed margin");
assert.match(quoteFormPage, /finalPrice:\s*priceWasAdjusted\s*\?\s*\(adjustedPriceNum\s*\?\?\s*0\)\s*:\s*0/, "auto-calculated prices are recomputed while manual sale prices are preserved");
assert.match(quoteFormPage, /if \(value\.trim\(\) === "" && result\)[\s\S]*?setAdjustedPrice\(result\.finalPrice > 0 \? String\(result\.finalPrice\) : ""\)/, "clearing an adjustment restores the calculated sale price");
assert.match(quoteFormPage, /\(\(priceWasAdjusted \|\| result\)[\s\S]*?\?\s*adjustedPriceValid\s*:\s*marginNum > 0 && marginNum < 100/, "saved loss-making quotes remain editable without relaxing new-quote margin validation");
assert.match(quotePage, /\bSend\b/, "each quote row has a Send action");
assert.match(quotePage, /\bBetweenHorizontalStart\b/, "new-order creation uses the requested icon");
const editAction = quotePage.indexOf("onClick={() => onEdit(q.id)}");
const addAction = quotePage.indexOf("<QuoteOrderPopover", editAction);
const deleteAction = quotePage.indexOf("{confirmId === q.id ? (", addAction);
assert.ok(editAction < addAction && addAction < deleteAction, "the Send action sits immediately after edit and before delete");
assert.match(
  quotePage,
  /<Button asChild variant="outline" size="icon-lg" className="size-11">\s*<PopoverPrimitive\.Trigger[\s\S]*?aria-label=\{t\("quotes\.addToOrder"/,
  "the Send trigger is accessible and meets the shared action touch target",
);
assert.match(quotePage, /<PopoverPrimitive\.Portal>[\s\S]*?<PopoverPrimitive\.Content[\s\S]*?align="end"/, "the popover is portaled and aligned to its trigger");
assert.match(
  quotePage,
  /<PopoverPrimitive\.Content[\s\S]*?quotes\.orderSearchPlaceholder[\s\S]*?quotes\.openOrders/,
  "the popover exposes its order search and open-orders section",
);
assert.match(quotePage, /max-w-\[calc\(100vw-2rem\)\][\s\S]*?bg-popover/, "the popover uses responsive Tailwind styling");
assert.match(
  quotePage,
  /const openOrders = orders\.filter\([\s\S]*?!order\.completedAt[\s\S]*?!order\.archivedAt[\s\S]*?\);/,
  "the popover lists only open production orders",
);
assert.match(
  quotePage,
  /filterByName\(\s*openOrders,\s*search,\s*\(order\)\s*=>\s*order\.title,?\s*\)/,
  "the popover filters orders with the quote-list name search behavior",
);
assert.match(
  quotePage,
  /<Checkbox[\s\S]*?checked=\{selectedOrderIds\.includes\(order\.id\)\}/,
  "each production order is independently selectable",
);
assert.match(
  quotePage,
  /for \(const orderId of orderIds\)[\s\S]*?LedgerService\.AddProductionTicket\(orderId, quote\.id\)/,
  "the selected quote is added to every selected open order",
);
assert.match(
  quotePage,
  /const order = await LedgerService\.CreateProductionOrder\(title\);[\s\S]*?await LedgerService\.AddProductionTicket\(order\.id, quote\.id\);/,
  "creating an order also adds the selected quote to it",
);
assert.match(
  quotePage,
  /title=\{t\("quotes\.createOrderAndAddTooltip"\)\}/,
  "the new-order action exposes its tooltip",
);

const locales = await Promise.all(
  ["pt-BR", "en", "es"].map(async (locale) => {
    const text = await readFile(
      new URL(`../../src/i18n/locales/${locale}/translation.json`, import.meta.url),
      "utf8",
    );
    return [locale, JSON.parse(text)] as const;
  }),
);
for (const [locale, translations] of locales) {
  assert.ok(translations.quoteForm.fields.adjustedPrice, `${locale} has quoteForm.fields.adjustedPrice`);
  for (const key of [
    "addToOrder",
    "orderSearchPlaceholder",
    "openOrders",
    "noOpenOrders",
    "noMatchingOrders",
    "loadingOrders",
    "addingToOrders",
    "creatingOrder",
    "addSelectedOrder",
    "addSelectedOrders",
    "selectOrdersToAdd",
    "createOrderLabel",
    "createOrderPlaceholder",
    "createOrderAndAddTooltip",
    "addedToOneOrder",
    "addedToManyOrders",
    "partiallyAddedOrders",
    "createdOrderAndAdded",
    "createdOrderButAddFailed",
  ]) {
    assert.ok(translations.quotes[key], `${locale} has quotes.${key}`);
  }
}
assert.equal(
  locales.find(([locale]) => locale === "pt-BR")?.[1].quotes.createOrderAndAddTooltip,
  "Criar novo pedido e adicionar item",
  "the create-order tooltip matches the requested Portuguese copy",
);
assert.equal(
  locales.find(([locale]) => locale === "pt-BR")?.[1].quoteForm.fields.adjustedPrice,
  "Preço ajustado",
  "the adjusted sale-price field uses the requested Portuguese copy",
);

console.log("Quote-to-production order actions passed");
