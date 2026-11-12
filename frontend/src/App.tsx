import { useState } from "react";
import { Calculator, Settings as SettingsIcon } from "lucide-react";
import appIcon from "../../assets/app.png";
import Quotes from "./pages/Quotes";
import QuoteForm from "./pages/QuoteForm";
import Settings from "./pages/Settings";

type View = { page: "quotes" } | { page: "settings" } | { page: "form"; quoteId?: number };

export default function App() {
  const [view, setView] = useState<View>({ page: "quotes" });

  return (
    <div className="app">
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
          <span>Orçamentos</span>
        </button>
        <button
          className="nav-item"
          aria-current={view.page === "settings" ? "page" : undefined}
          onClick={() => setView({ page: "settings" })}
        >
          <SettingsIcon size={18} aria-hidden="true" />
          <span>Configurações</span>
        </button>
      </nav>
      <main className="content">
        {view.page === "quotes" ? (
          <Quotes
            onNew={() => setView({ page: "form" })}
            onEdit={(id) => setView({ page: "form", quoteId: id })}
          />
        ) : view.page === "form" ? (
          <QuoteForm quoteId={view.quoteId} onBack={() => setView({ page: "quotes" })} />
        ) : (
          <Settings />
        )}
      </main>
    </div>
  );
}
