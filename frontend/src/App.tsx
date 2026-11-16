import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, Factory, Settings as SettingsIcon } from "lucide-react";
import appIcon from "../../assets/app.png";
import { languageOptions } from "./i18n";
import { Button } from "./components/ui/button";
import ProductionWorkspace from "./pages/ProductionWorkspace";
import Quotes from "./pages/Quotes";
import QuoteForm from "./pages/QuoteForm";
import Settings from "./pages/Settings";

type View = { page: "quotes" } | { page: "production" } | { page: "settings" } | { page: "form"; quoteId?: number };

export default function App() {
  const [view, setView] = useState<View>({ page: "quotes" });
  const { t, i18n } = useTranslation();

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr] bg-background text-foreground md:h-svh md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-1">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        href="#main-content"
      >
        {t("common.skipToContent")}
      </a>
      <nav className="flex min-w-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:min-h-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-4 py-3 md:px-5 md:py-5">
          <img
            className="size-10 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
            src={appIcon}
            alt=""
          />
          <span className="truncate text-lg font-semibold tracking-tight">
            Led<span className="text-primary">ger</span>
          </span>
        </div>
        <div className="flex min-w-0 gap-2 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto md:py-1">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-11 shrink-0 justify-start gap-3 px-3 text-muted-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary md:w-full"
            aria-current={view.page === "quotes" || view.page === "form" ? "page" : undefined}
            onClick={() => setView({ page: "quotes" })}
          >
            <Calculator aria-hidden="true" />
            <span>{t("nav.quotes")}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-11 shrink-0 justify-start gap-3 px-3 text-muted-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary md:w-full"
            aria-current={view.page === "production" ? "page" : undefined}
            onClick={() => setView({ page: "production" })}
          >
            <Factory aria-hidden="true" />
            <span>{t("nav.production")}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-11 shrink-0 justify-start gap-3 px-3 text-muted-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary md:w-full"
            aria-current={view.page === "settings" ? "page" : undefined}
            onClick={() => setView({ page: "settings" })}
          >
            <SettingsIcon aria-hidden="true" />
            <span>{t("nav.settings")}</span>
          </Button>
        </div>
        <label
          className="grid w-full max-w-xs gap-1 px-4 pb-4 text-sm text-muted-foreground md:mt-auto md:px-5 md:pb-5"
          htmlFor="language-select"
        >
          <span>{t("language.label")}</span>
          <select
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            id="language-select"
            value={i18n.resolvedLanguage ?? i18n.language}
            onChange={(event) => void i18n.changeLanguage(event.target.value)}
          >
            {languageOptions.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </nav>
      <main id="main-content" className="min-h-0 min-w-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          {view.page === "quotes" ? (
            <Quotes
              onNew={() => setView({ page: "form" })}
              onEdit={(id) => setView({ page: "form", quoteId: id })}
            />
          ) : view.page === "form" ? (
            <QuoteForm quoteId={view.quoteId} onBack={() => setView({ page: "quotes" })} />
          ) : view.page === "production" ? (
            <ProductionWorkspace />
          ) : (
            <Settings />
          )}
        </div>
      </main>
    </div>
  );
}
