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

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e) => setState((s) => ({ ...s, error: errText(e), loading: false })));
  }, []);

  useEffect(() => {
    run();
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
