import { randomBytes, timingSafeEqual } from "node:crypto";

export const MIN_SYNC_TOKEN_LENGTH = 32;

export const generateSyncToken = () => randomBytes(24).toString("base64url");

export const isStrongSyncToken = (token: string | undefined): token is string =>
  typeof token === "string" && token.length >= MIN_SYNC_TOKEN_LENGTH;

export const safeTokenEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf-8"), Buffer.from(b, "utf-8"));
};
