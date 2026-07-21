import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function encryptApiKey(apiKey: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptApiKey(encryptedKey: string) {
  const key = getEncryptionKey();
  const [ivText, tagText, encryptedText] = encryptedKey.split(".");

  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Stored API key is malformed.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("API_KEY_ENCRYPTION_SECRET must be configured with a strong secret.");
  }

  return createHash("sha256").update(secret).digest();
}