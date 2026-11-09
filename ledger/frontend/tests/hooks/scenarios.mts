import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installFakeDom, flush } from "./fake-dom.mts";

process.env.NODE_ENV = "production";
const { window } = installFakeDom();
const React = (await import("react")).default;
const ReactDOM = (await import("react-dom/client")).default;
const hooksPath = process.env.HOOKS_PATH;
if (!hooksPath) throw new Error("HOOKS_PATH must point to the candidate hooks.ts");
const { useAsync, useSubmission } = await import(hooksPath);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 8; i++) await flush(12);
}

const loaders = new Map<number, () => Promise<string>>();
let latestAsyncState: any;
function AsyncView({ version }: { version: number }) {
  const state = useAsync(() => loaders.get(version)!(), [version]);
  React.useEffect(() => {
    latestAsyncState = state;
  });
  return React.createElement("p", { role: "alert" }, state.error ?? state.data ?? "loading");
}

const asyncRoot = window.document.createElement("div");
const asyncRenderer = ReactDOM.createRoot(asyncRoot);

// The newest reload wins even when an older successful request finishes later.
const oldRequest = deferred<string>();
loaders.set(1, () => oldRequest.promise);
asyncRenderer.render(React.createElement(AsyncView, { version: 1 }));
await settle();
const reload = latestAsyncState.reload;
loaders.set(1, () => Promise.resolve("new result"));
reload();
await settle();
assert.equal(latestAsyncState.data, "new result");
oldRequest.resolve("old result");
await settle();
assert.equal(latestAsyncState.data, "new result");

// A stale rejection cannot overwrite the latest successful result.
const oldError = deferred<string>();
loaders.set(1, () => oldError.promise);
latestAsyncState.reload();
await settle();
loaders.set(1, () => Promise.resolve("latest result"));
latestAsyncState.reload();
await settle();
oldError.reject(new Error("stale failure"));
await settle();
assert.equal(latestAsyncState.data, "latest result");
assert.equal(latestAsyncState.error, null);

// Changing dependencies invalidates completions from the previous request.
const oldDependency = deferred<string>();
loaders.set(2, () => oldDependency.promise);
asyncRenderer.render(React.createElement(AsyncView, { version: 2 }));
await settle();
loaders.set(3, () => Promise.resolve("new dependency"));
asyncRenderer.render(React.createElement(AsyncView, { version: 3 }));
await settle();
oldDependency.reject(new Error("stale dependency"));
await settle();
assert.equal(latestAsyncState.data, "new dependency");
assert.equal(latestAsyncState.error, null);

// Unmounting invalidates outstanding work.
const afterUnmount = deferred<string>();
loaders.set(4, () => afterUnmount.promise);
asyncRenderer.render(React.createElement(AsyncView, { version: 4 }));
await settle();
asyncRenderer.unmount();
afterUnmount.resolve("late result");
await settle();

// The submission lock rejects a duplicate before it can invoke its action.
let submissionState: any;
const busyStates: boolean[] = [];
function SubmissionView() {
  const state = useSubmission();
  React.useEffect(() => {
    submissionState = state;
    busyStates.push(state.busy);
  }, [state.busy]);
  return React.createElement("div", null, state.busy ? "busy" : "idle");
}

const submissionRoot = window.document.createElement("div");
const submissionRenderer = ReactDOM.createRoot(submissionRoot);
submissionRenderer.render(React.createElement(SubmissionView));
await flush(30);
const saveRequest = deferred<string>();
let saveCalls = 0;
const firstSave = submissionState.run(async () => {
  saveCalls++;
  return saveRequest.promise;
});
const duplicateSave = await submissionState.run(async () => {
  saveCalls++;
  return "duplicate";
});
assert.equal(duplicateSave, undefined);
assert.equal(saveCalls, 1);
await settle();
assert.ok(busyStates.includes(true));
saveRequest.resolve("saved");
assert.equal(await firstSave, "saved");
await settle();
assert.equal(submissionState.busy, false);

// The lock is released after both success and failure.
const afterSuccess = await submissionState.run(async () => {
  saveCalls++;
  return "saved again";
});
assert.equal(afterSuccess, "saved again");
let rejected = false;
await submissionState
  .run(async () => {
    throw new Error("save failed");
  })
  .catch(() => {
    rejected = true;
  });
const afterFailure = await submissionState.run(async () => "retry succeeded");
assert.equal(rejected, true);
assert.equal(afterFailure, "retry succeeded");
submissionRenderer.unmount();

// Keep the one-line quote-delete error path covered without importing Wails IPC.
const quotes = readFileSync(new URL("../../src/pages/Quotes.tsx", import.meta.url), "utf8");
assert.match(quotes, /catch \(e\) \{\s*setActionError\(e\);/);
assert.match(quotes, /role="alert">\{actionError\}/);

// Every insert-capable settings form and the inline category form must use the guard.
const settings = readFileSync(new URL("../../src/pages/Settings.tsx", import.meta.url), "utf8");
const quoteForm = readFileSync(new URL("../../src/pages/QuoteForm.tsx", import.meta.url), "utf8");
assert.equal((settings.match(/const \{ busy, run \} = useSubmission\(\);/g) ?? []).length, 4);
assert.equal((settings.match(/await run\(async \(\) => \{/g) ?? []).length, 4);
assert.match(quoteForm, /const \{ busy, run: runExclusive \} = useSubmission\(\);/);
assert.match(quoteForm, /await runExclusive\(async \(\) => \{/);
assert.match(quoteForm, /disabled=\{!newCat\.name\.trim\(\) \|\| busy\}/);

// Importing from Spoolman refreshes the independently loaded filament list.
assert.match(settings, /<FilamentsSection refreshKey=\{filamentsRefreshKey\} \/>/);
assert.match(
  settings,
  /<SpoolmanSection\s+onImported=\{\(\)\s*=>\s*setFilamentsRefreshKey\(\(key\)\s*=>\s*key\s*\+\s*1\)\}\s*\/>/,
);
assert.match(settings, /function FilamentsSection\(\{ refreshKey \}: \{ refreshKey: number \}\)/);
assert.match(settings, /useAsync\(\(\) => LedgerService\.ListFilaments\(\), \[refreshKey\]\)/);
assert.match(settings, /const n = await LedgerService\.ImportSpoolman\(value\.trim\(\)\);\s+onImported\(\);/);

console.log("T10 hook and UI regression probes passed.");
