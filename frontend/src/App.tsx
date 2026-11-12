import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, Factory, Settings as SettingsIcon } from "lucide-react";
import appIcon from "../../assets/app.png";
import { languageOptions } from "./i18n";
import ProductionBoard from "./pages/ProductionBoard";
import Quotes from "./pages/Quotes";
import QuoteForm from "./pages/QuoteForm";
import Settings from "./pages/Settings";

type View = { page: "quotes" } | { page: "production" } | { page: "settings" } | { page: "form"; quoteId?: number };

export default function App() {
  const [view, setView] = useState<View>({ page: "quotes" });
  const { t, i18n } = useTranslation();

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">{t("common.skipToContent")}</a>
      <nav className="sidebar">
        <div className="brand">
          <img className="brand-icon" src={appIcon} alt="" />
          <div>
            Led<span>ger</span>
          </div>
        </div>
        <button
          className="nav-item"
          aria-current={view.page === "quotes" || view.page === "form" ? "page" : undefined}
          onClick={() => setView({ page: "quotes" })}
        >
          <Calculator size={18} aria-hidden="true" />
          <span>{t("nav.quotes")}</span>
        </button>
        <button
          className="nav-item"
          aria-current={view.page === "production" ? "page" : undefined}
          onClick={() => setView({ page: "production" })}
        >
          <Factory size={18} aria-hidden="true" />
          <span>{t("nav.production")}</span>
        </button>
        <button
          className="nav-item"
          aria-current={view.page === "settings" ? "page" : undefined}
          onClick={() => setView({ page: "settings" })}
        >
          <SettingsIcon size={18} aria-hidden="true" />
          <span>{t("nav.settings")}</span>
        </button>
        <label className="language-switcher" htmlFor="language-select">
          <span>{t("language.label")}</span>
          <select
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
      <main id="main-content" className="content">
        {view.page === "quotes" ? (
          <Quotes
            onNew={() => setView({ page: "form" })}
            onEdit={(id) => setView({ page: "form", quoteId: id })}
          />
        ) : view.page === "form" ? (
          <QuoteForm quoteId={view.quoteId} onBack={() => setView({ page: "quotes" })} />
        ) : view.page === "production" ? (
          <ProductionBoard />
        ) : (
          <Settings />
        )}
      </main>
    </div>
  );
}
