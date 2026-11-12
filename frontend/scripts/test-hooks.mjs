import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", resolve(frontendRoot, "tests/hooks/scenarios.mts")],
  {
    cwd: frontendRoot,
    env: { ...process.env, HOOKS_PATH: resolve(frontendRoot, "src/lib/hooks.ts") },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
