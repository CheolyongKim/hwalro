import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = process.platform === "win32" ? "migrate-auth-roles.ps1" : "migrate-auth-roles.sh";
const scriptPath = fileURLToPath(new URL(`./${script}`, import.meta.url));
const command = process.platform === "win32" ? "powershell.exe" : "bash";
const args =
  process.platform === "win32" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath] : [scriptPath];

const child = spawn(command, args, { stdio: "inherit" });

child.on("error", (error) => {
  console.error(`Failed to start ${command}: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
