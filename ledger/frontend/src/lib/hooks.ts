import { useCallback, useEffect, useRef, useState } from "react";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export type Async<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

// Carrega uma promise e expõe reload; deps primitivos (rerender-dependencies).
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const requestId = useRef(0);

  const run = useCallback(() => {
    const currentRequest = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => fnRef.current())
      .then((data) => {
        if (requestId.current === currentRequest) setState({ data, error: null, loading: false });
      })
      .catch((e) => {
        if (requestId.current === currentRequest) {
          setState((s) => ({ ...s, error: errText(e), loading: false }));
        }
      });
  }, []);

  useEffect(() => {
    run();
    return () => {
      requestId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}

// Estado de erro simples para ações (salvar/excluir/importar).
export function useActionError(): [string | null, (e: unknown) => void, () => void] {
  const [error, setError] = useState<string | null>(null);
  const set = useCallback((e: unknown) => setError(errText(e)), []);
  const clear = useCallback(() => setError(null), []);
  return [error, set, clear];
}

// Guarda um handler assíncrono contra submits simultâneos, inclusive antes do
// próximo render atualizar o estado `busy` usado pelo botão.
export function useSubmission() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
