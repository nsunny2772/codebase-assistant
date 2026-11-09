import { spawn } from "node:child_process";
import { scriptStrings } from "./constants.mjs";

let stopping = false;
let server;

const startProcess = (file) =>
  spawn(process.execPath, ["--import", "tsx", "--watch", file], {
    stdio: "inherit",
  });

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  server?.kill("SIGTERM");
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop(0));

server = startProcess("src/server.ts");
server.once("error", (error) => {
  console.error(scriptStrings.BACKEND_START_FAILED(error.message));
  stop(1);
});
server.once("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});

