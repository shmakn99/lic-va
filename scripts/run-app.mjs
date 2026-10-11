import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const mode = process.argv[2] === "start" ? "start" : "dev";
const streaming = process.env.VOICE_STREAMING_ENABLED !== "false";
const env = { ...process.env, VOICE_STREAMING_ENABLED: String(streaming), VOICE_SESSION_SECRET: process.env.VOICE_SESSION_SECRET || randomBytes(32).toString("hex") };
const children = [];
// Use the OS trust store as well as Node's bundled roots (e.g. managed Windows
// networks). Apply to both children, regardless of how this launcher was started.
// Certificate and hostname verification remain enabled.
if (streaming) children.push(spawn(process.execPath, ["--use-system-ca", "--import", "tsx", "server/voice.ts"], { env, stdio: "inherit", windowsHide: true }));
children.push(spawn(process.execPath, ["--use-system-ca", "node_modules/next/dist/bin/next", mode, "--hostname", "127.0.0.1"], { env, stdio: "inherit", windowsHide: true }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); setTimeout(() => process.exit(code), 1000).unref(); }
for (const child of children) { child.on("error", () => stop(1)); child.on("exit", code => stop(code || 0)); }
process.on("SIGINT", () => stop()); process.on("SIGTERM", () => stop());
