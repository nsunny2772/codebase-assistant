import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// Generated output is rebuilt so moved MVC modules cannot leave stale artifacts.
rmSync(fileURLToPath(new URL("../dist/", import.meta.url)), {
  recursive: true,
  force: true,
});
const compiler = require.resolve("typescript/bin/tsc");

const result = spawnSync(
  process.execPath,
  [
    compiler,
    "-p",
    fileURLToPath(new URL("../tsconfig.build.json", import.meta.url)),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
