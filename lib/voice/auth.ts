import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export function issueTicket(secret: string, origin: string, now = Date.now(), challenge?: string) {
  const body = Buffer.from(JSON.stringify({ id: randomUUID(), origin, expires: now + 30_000, challenge })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function verifyTicket(ticket: string, secret: string, origin: string, now = Date.now(), challenge?: string) {
  const [body, signature, extra] = ticket.split(".");
  if (!body || !signature || extra) throw new Error("Invalid ticket");
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid ticket");
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (data.challenge !== challenge) throw new Error("Ticket belongs to another connection");
  if (typeof data.id !== "string" || data.origin !== origin || !Number.isFinite(data.expires) || data.expires < now || data.expires > now + 30_000) throw new Error("Expired ticket");
  return data as { id: string; expires: number; origin: string };
}
