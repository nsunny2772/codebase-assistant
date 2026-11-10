import { spawn } from "node:child_process";
import process from "node:process";

const workspaces = [
  {
    name: "frontend",
    args: ["run", "dev", "--workspace", "@codebase-assistant/frontend"],
  },
  {
    name: "backend",
    args: ["run", "dev", "--workspace", "@codebase-assistant/backend"],
  },
];

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Map();
let shuttingDown = false;

const stopChildren = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) child.kill(signal);
};

for (const workspace of workspaces) {
  const child = spawn(npmCommand, workspace.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  children.set(workspace.name, child);
  child.on("error", (error) => {
    console.error(`[${workspace.name}] failed to start: ${error.message}`);
    process.exitCode = 1;
    stopChildren("SIGTERM");
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ?? `exit code ${code}`;
    console.error(`[${workspace.name}] dev server stopped (${reason})`);
    process.exitCode = code ?? 1;
    stopChildren("SIGTERM");
  });
}

process.once("SIGINT", () => stopChildren("SIGINT"));
process.once("SIGTERM", () => stopChildren("SIGTERM"));
