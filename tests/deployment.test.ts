import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { voiceDeployment, voiceOriginAllowed } from "../lib/voice/deployment";
import { attachVoiceSocket, VoiceAdmission } from "../lib/voice/socket";
import { issueTicket, verifyTicket } from "../lib/voice/auth";
import { POST } from "../app/api/voice/session/route";
import { GET as socketGET } from "../app/api/voice/socket/route";
import { GET as statusGET } from "../app/api/status/route";
import { POST as speakPOST } from "../app/api/speak/route";

const origin = "https://lic-va.vercel.app";
const env = { VERCEL: "1", VOICE_STREAMING_ENABLED: "true", VOICE_SESSION_SECRET: "test-secret-".repeat(4), SARVAM_API_KEY: "test-key" };
function configure(t: test.TestContext) {
  for (const name of [...Object.keys(env), "VOICE_PUBLIC_URL", "VOICE_ALLOWED_ORIGINS", "VOICE_MAX_SESSIONS"]) {
    const previous = process.env[name];
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
    delete process.env[name];
  }
  Object.assign(process.env, env);
}
test("deployment readiness rejects incomplete credentials and unsafe production URLs", () => {
  assert.equal(voiceDeployment(env).enabled, true);
  for (const change of [
    { VOICE_SESSION_SECRET: "short" }, { SARVAM_API_KEY: " " }, { VOICE_STREAMING_ENABLED: "false" },
    { VOICE_PUBLIC_URL: "ws://127.0.0.1:3001/voice" }, { VOICE_PUBLIC_URL: "https://voice.example" },
    { VOICE_PUBLIC_URL: "wss://user:password@voice.example" },
  ]) assert.equal(voiceDeployment({ ...env, ...change }).enabled, false);
  assert.equal(voiceDeployment({ ...env, VOICE_PUBLIC_URL: "wss://voice.example/voice" }).enabled, true);
  assert.equal(voiceDeployment({ ...env, VERCEL: undefined }).enabled, true);
});
test("Vercel allows the current origin or exact configured origins, never a wildcard", () => {
  assert.equal(voiceOriginAllowed(origin, origin + "/api/voice/session", env), true);
  assert.equal(voiceOriginAllowed("https://evil.example", origin + "/api/voice/session", env), false);
  assert.equal(voiceOriginAllowed(null, origin, env), false);
  const configured = { ...env, VOICE_ALLOWED_ORIGINS: " https://other.example, " + origin + " " };
  assert.equal(voiceOriginAllowed(origin, origin, configured), true);
  assert.equal(voiceOriginAllowed("https://preview.vercel.app", "https://preview.vercel.app", configured), false);
});
test("session discovery and ticket issuance match status, validate input, and never expose secrets", async t => {
  configure(t);
  const request = (body?: string, requestOrigin = origin) => new Request(origin + "/api/voice/session", {
    method: "POST", headers: { origin: requestOrigin, "Content-Type": "application/json" }, body,
  });
  const discovery = await POST(request());
  assert.equal(discovery.headers.get("cache-control"), "no-store");
  assert.deepEqual(await discovery.json(), { url: "wss://lic-va.vercel.app/api/voice/socket", authentication: "challenge" });
  const streamedEmpty = new Request(origin + "/api/voice/session", {
    method: "POST", headers: { origin }, body: "",
  });
  assert.notEqual(streamedEmpty.body, null);
  assert.equal((await POST(streamedEmpty)).status, 200);
  const challenge = "12345678-1234-4234-8234-123456789012";
  const issued = await (await POST(request(JSON.stringify({ challenge })))).json();
  verifyTicket(issued.ticket, env.VOICE_SESSION_SECRET, origin, Date.now(), challenge);
  assert.throws(() => verifyTicket(issued.ticket, env.VOICE_SESSION_SECRET, origin, Date.now(), "other-socket"));
  assert.equal((await POST(request('{"challenge":"bad"}'))).status, 400);
  assert.equal((await POST(request("x".repeat(1025)))).status, 413);
  assert.equal((await POST(request(undefined, "https://evil.example"))).status, 403);
  assert.deepEqual(await statusGET().json(), { configured: true, streaming: true });
  process.env.VOICE_SESSION_SECRET = "short";
  assert.equal((await POST(request())).status, 503);
  assert.deepEqual(await statusGET().json(), { configured: true, streaming: false });
});
test("admission bounds concurrent connections, releases once, and expires attempt windows", () => {
  const admission = new VoiceAdmission();
  const release = admission.reserve("one", 1, 1000)!;
  assert.ok(release);
  assert.equal(admission.reserve("two", 1, 1000), undefined);
  release(); release();
  const second = admission.reserve("two", 1, 1000)!;
  assert.ok(second);
  assert.equal(admission.reserve("three", 1, 1000), undefined);
  second();
  for (let index = 0; index < 30; index++) admission.reserve("rate", 10, 1000)!();
  assert.equal(admission.reserve("rate", 10, 1000), undefined);
  assert.ok(admission.reserve("rate", 10, 61_001));
  assert.equal(admission.reserve("invalid", Number.NaN), undefined);
});
test("Vercel route rejects ordinary requests and fails safely without its runtime bridge", async t => {
  configure(t);
  assert.equal((await socketGET(new Request(origin + "/api/voice/socket"))).status, 403);
  assert.equal((await socketGET(new Request(origin + "/api/voice/socket", { headers: { origin } }))).status, 426);
  assert.equal((await socketGET(new Request(origin + "/api/voice/socket", { headers: { origin, upgrade: "websocket" } }))).status, 503);
});

async function until(check: () => boolean) {
  for (let index = 0; index < 200; index++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail("Expected socket event did not arrive");
}
test("actual Vercel SDK upgrade authenticates a real socket and rejects replay on another instance", async t => {
  configure(t);
  // Supply only the runtime bridge; the route and installed Vercel SDK are real.
  const storage = new AsyncLocalStorage<object>();
  const symbol = Symbol.for("@vercel/request-context");
  const globals = globalThis as typeof globalThis & { [symbol]: unknown };
  const previous = globals[symbol]; globals[symbol] = { get: () => storage.getStore() };
  t.after(() => { globals[symbol] = previous; });
  const server = createServer();
  const sockets = new Set<WebSocket>();
  const failures: unknown[] = [];
  server.on("upgrade", (req, socket, head) => {
    storage.run({ upgradeWebSocket: () => ({ req, socket, head }) }, () => {
      void socketGET(new Request(origin + "/api/voice/socket", { headers: { origin, upgrade: "websocket" } }))
        .then(response => { if (response.status !== 204) failures.push(response.status); }).catch(error => failures.push(error));
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { for (const ws of sockets) ws.terminate(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const port = (server.address() as { port: number }).port;
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/voice/socket`, { origin }); sockets.add(ws);
    const events: Array<{ type: string; challenge?: string }> = [];
    ws.on("message", data => events.push(JSON.parse(data.toString())));
    await until(() => events.some(event => event.type === "challenge"));
    return { ws, events };
  }
  const first = await connect();
  const ticketResponse = await POST(new Request(origin + "/api/voice/session", {
    method: "POST", headers: { origin }, body: JSON.stringify({ challenge: first.events[0].challenge }),
  }));
  const { ticket } = await ticketResponse.json();
  first.ws.send(JSON.stringify({ type: "authenticate", ticket }));
  await until(() => first.events.some(event => event.type === "ready"));
  const second = await connect();
  const rejected = once(second.ws, "close");
  second.ws.send(JSON.stringify({ type: "authenticate", ticket }));
  assert.equal((await rejected)[0], 1008);
  const stopped = once(first.ws, "close");
  first.ws.send(JSON.stringify({ type: "stop" }));
  assert.equal((await stopped)[0], 1000);
  assert.deepEqual(failures, []);
});
test("scheduled connection renewal releases capacity and closes with a reconnectable code", async t => {
  let released = 0;
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  server.on("connection", ws => attachVoiceSocket(ws, { origin, secret: env.VOICE_SESSION_SECRET, release: () => released++, lifetimeMs: 100 }));
  await once(server, "listening");
  t.after(() => server.close());
  const ws = new WebSocket(`ws://127.0.0.1:${(server.address() as { port: number }).port}`);
  ws.on("message", data => {
    const event = JSON.parse(data.toString());
    if (event.type === "challenge") ws.send(JSON.stringify({ type: "authenticate", ticket: issueTicket(env.VOICE_SESSION_SECRET, origin, Date.now(), event.challenge) }));
  });
  assert.equal((await once(ws, "close"))[0], 1001);
  await until(() => released === 1);
});
test("oversized speech returns a recoverable JSON error below Vercel's response limit", async t => {
  configure(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ audios: ["a".repeat(4_000_001)] }));
  const response = await speakPOST(new Request(origin + "/api/speak", {
    method: "POST", body: JSON.stringify({ text: "Explain term insurance", language: "en-IN" }),
  }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Audio was too long/);
});
