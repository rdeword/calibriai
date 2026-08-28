import crypto from "node:crypto";

function key() {
  const value = process.env.APP_ENCRYPTION_KEY;
  if (!value) throw new Error("APP_ENCRYPTION_KEY не задан.");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("APP_ENCRYPTION_KEY должен быть 32-байтным base64-значением.");
  return decoded;
}

export function encryptSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { encryptedApiKey: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(data: { encryptedApiKey: string; iv: string; authTag: string }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data.encryptedApiKey, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(secret: string) {
  return secret.length < 8 ? "••••" : `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}
