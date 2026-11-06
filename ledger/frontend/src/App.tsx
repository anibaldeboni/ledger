import { useState } from "react";
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
          Led<span>ger</span>
        </div>
        <button
          className="nav-item"
          aria-current={view.page === "quotes" || view.page === "form" ? "page" : undefined}
          onClick={() => setView({ page: "quotes" })}
        >
          Orçamentos
        </button>
        <button
          className="nav-item"
          aria-current={view.page === "settings" ? "page" : undefined}
          onClick={() => setView({ page: "settings" })}
        >
          Cadastros
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
