import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getVaultKey(): Buffer {
  const raw = process.env.JAMAKER_VAULT_KEY;
  if (raw) {
    try {
      const asBase64 = Buffer.from(raw, "base64");
      if (asBase64.length === 32) return asBase64;
      const asHex = Buffer.from(raw, "hex");
      if (asHex.length === 32) return asHex;
      if (raw.length === 32) return Buffer.from(raw, "utf8");
    } catch {
      // fallthrough to dev key
    }
  }
  // Clé dev éphémère : les secrets ne survivent pas à un redémarrage sans JAMAKER_VAULT_KEY.
  // En production, définissez JAMAKER_VAULT_KEY (32 octets base64).
  if (!globalThis.__jaMakerDevVaultKey) {
    globalThis.__jaMakerDevVaultKey = randomBytes(32);
  }
  return globalThis.__jaMakerDevVaultKey as Buffer;
}

declare global {
  // eslint-disable-next-line no-var
  var __jaMakerDevVaultKey: Buffer | undefined;
}

export function encryptSecret(plaintext: string) {
  const key = getVaultKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encryptedValue: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: tag.toString("base64") };
}

export function decryptSecret(encryptedValue: string, iv: string, authTag: string) {
  const key = getVaultKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64")), decipher.final()]).toString("utf8");
}

export function isVaultConfigured() {
  return Boolean(process.env.JAMAKER_VAULT_KEY);
}
