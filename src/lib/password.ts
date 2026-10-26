import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt with a per-user salt; both values are stored, never the password. */
export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

export function checkPassword(password: string, salt: string, hash: string) {
  const given = Buffer.from(hashPassword(password, salt).hash, "hex");
  const stored = Buffer.from(hash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}
