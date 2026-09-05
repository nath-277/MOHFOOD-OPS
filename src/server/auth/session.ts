// Session and Cryptographic Authentication Utilities for Moh Foods NG (MOH-OPS)

export interface UserSessionPayload {
  sessionId: string;
  userId: string;
  staffId: string;
  fullName: string;
  email: string;
  role: string;
  departmentCode: string;
  phone?: string;
  activeShift?: "MORNING_SHIFT" | "NIGHT_SHIFT" | null;
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_SECRET = "moh-foods-secure-dev-secret-key-32-chars-min!";
const AUTH_SECRET = process.env.AUTH_SECRET || DEFAULT_SECRET;
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "moh_session";

// ==========================================
// CRYPTO HELPERS (WEB CRYPTO API)
// ==========================================
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Sign a session payload into a signed base64 token
export async function signSession(payload: UserSessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const dataString = JSON.stringify(payload);
  const dataB64 = Buffer.from(dataString).toString("base64url");

  const key = await getCryptoKey(AUTH_SECRET);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigB64 = Buffer.from(signature).toString("base64url");

  return `${dataB64}.${sigB64}`;
}

// Verify a signed token and extract payload
export async function verifySession(token: string): Promise<UserSessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [dataB64, sigB64] = parts;
    const enc = new TextEncoder();
    const key = await getCryptoKey(AUTH_SECRET);

    const sigBuffer = Buffer.from(sigB64, "base64url");
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      enc.encode(dataB64)
    );

    if (!isValid) return null;

    const jsonString = Buffer.from(dataB64, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonString) as UserSessionPayload;

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ==========================================
// PASSWORD & PIN HASHING
// ==========================================
export async function hashPassword(password: string): Promise<string> {
  // Use Bun native Argon2id if available, otherwise SHA-256 with salt
  if (typeof Bun !== "undefined" && Bun.password) {
    return await Bun.password.hash(password, { algorithm: "argon2id" });
  }

  const salt = crypto.randomUUID();
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(salt + password));
  return `sha256:${salt}:${Buffer.from(digest).toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (typeof Bun !== "undefined" && Bun.password && !hash.startsWith("sha256:")) {
    return await Bun.password.verify(password, hash);
  }

  if (hash.startsWith("sha256:")) {
    const parts = hash.split(":");
    if (parts.length !== 3) return false;
    const [, salt, originalDigest] = parts;
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(salt + password));
    return Buffer.from(digest).toString("hex") === originalDigest;
  }

  return false;
}

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`moh_pin_salt_${pin}`));
  return Buffer.from(digest).toString("hex");
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  return computed === hash;
}
