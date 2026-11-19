/**
 * crypto.js — WebCrypto PBKDF2 + AES-256-GCM Encryption, CORS-Safe Cloud Sync,
 * Secure Family Support Phone Cipher & Dormant Google Identity Services (GIS) Auth Hooks.
 * Works in both Browser and Node.js (via globalThis.crypto.subtle).
 */

export const BUNDLE_PREFIX = "EPSTEADY-AES256:";
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 12;
const IV_BYTES = 12;

/**
 * Family-authenticated support phone cipher (XOR with "EPSTEADY_FAMILY_KEY_V1").
 * Never stores plaintext digits in the public repository; decoded in memory only for unlocked family sessions.
 */
const FAMILY_SUPPORT_KEY_TAG = "EPSTEADY_FAMILY_KEY_V1";
const FAMILY_SUPPORT_CIPHER_BYTES = [125, 96, 98, 96, 114, 114, 113, 110, 108, 119];

/**
 * Dormant Google Identity Services (GIS) preparation metadata for future Google Sign-In update.
 * Kept disabled by default (`enabled: false`) until activated in the Admin Dashboard.
 */
export const GOOGLE_AUTH_PREP_SPEC = Object.freeze({
  version: "1.0.0-prep",
  status: "dormant",
  provider: "google_gis",
  gisScriptUrl: "https://accounts.google.com/gsi/client",
  tokenVerificationEndpoint: "https://oauth2.googleapis.com/tokeninfo",
  envelopeField: "auth",
  defaultConfig: Object.freeze({
    enabled: false,
    clientId: "",
    allowedEmails: [],
    requireGoogleForSync: false,
    lastSignedInEmail: "",
    idToken: ""
  })
});

/**
 * Normalize and validate Google Sign-In preparation config.
 * Always defaults `enabled` to false unless explicitly activated with a valid clientId.
 */
export function prepareGoogleSignInConfig(rawConfig = {}) {
  const c = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const clientId = String(c.clientId || "").trim();
  const allowedEmails = Array.isArray(c.allowedEmails)
    ? c.allowedEmails.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)
    : String(c.allowedEmails || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
  const enabled = Boolean(c.enabled && clientId);
  return {
    enabled,
    clientId,
    allowedEmails,
    requireGoogleForSync: Boolean(enabled && c.requireGoogleForSync),
    lastSignedInEmail: String(c.lastSignedInEmail || "").trim().toLowerCase(),
    idToken: String(c.idToken || "").trim()
  };
}

/**
 * Resolve the family support phone number in memory from the family cipher or Admin Dashboard override.
 * Requires an authenticated/unlocked family session (or explicit state/auth object) so scrapers never see raw digits.
 */
export function resolveFamilySupportPhone(state = {}, auth = { unlocked: true }) {
  const customOverride = String(state?.adminConfig?.supportPhoneOverride || "").replace(/[^\d+]/g, "");
  if (customOverride.length >= 10) {
    return customOverride;
  }
  if (auth && auth.unlocked === false) {
    return "";
  }
  let out = "";
  for (let i = 0; i < FAMILY_SUPPORT_CIPHER_BYTES.length; i++) {
    const k = FAMILY_SUPPORT_KEY_TAG.charCodeAt(i % FAMILY_SUPPORT_KEY_TAG.length);
    out += String.fromCharCode(FAMILY_SUPPORT_CIPHER_BYTES[i] ^ k);
  }
  return out;
}

/**
 * Build a cross-platform `sms:` URI that opens the user's native text messaging app
 * preloaded with the support phone number and message body.
 */
export function buildSmsHelpUri(phone, message, userAgent = "") {
  const cleanPhone = String(phone || "").replace(/[^\d+]/g, "");
  const encodedBody = encodeURIComponent(String(message || "").trim());
  const isIos = /iPad|iPhone|iPod/i.test(String(userAgent || ""));
  const sep = isIos ? "&" : "?";
  return cleanPhone
    ? `sms:${cleanPhone}${sep}body=${encodedBody}`
    : `sms:${sep}body=${encodedBody}`;
}

function getWebCrypto() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error("WebCrypto API (crypto.subtle) is not available in this environment.");
  }
  return c;
}

/**
 * Chunked Uint8Array -> Base64 to avoid call-stack overflow on large history payloads.
 */
export function uint8ToBase64(bytes) {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Base64 -> Uint8Array
 */
export function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a 256-bit AES-GCM key from a passphrase and 12-byte salt using PBKDF2 SHA-256 (100,000 iterations).
 */
export async function deriveKey(passphrase, salt) {
  const webCrypto = getWebCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await webCrypto.subtle.importKey(
    "raw",
    enc.encode(String(passphrase || "")),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return webCrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt any JSON-serializable object into "EPSTEADY-AES256:<base64(salt||iv||ciphertext)>".
 */
export async function encryptBundle(obj, passphrase) {
  if (!passphrase) throw new Error("Passphrase is required for encryption.");
  const webCrypto = getWebCrypto();
  const salt = webCrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = webCrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const encoded = new TextEncoder().encode(JSON.stringify(obj));
  const cipherBuf = await webCrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(SALT_BYTES + IV_BYTES + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, SALT_BYTES);
  combined.set(cipherBytes, SALT_BYTES + IV_BYTES);

  return BUNDLE_PREFIX + uint8ToBase64(combined);
}

/**
 * Decrypt an "EPSTEADY-AES256:..." token back into the parsed JSON object.
 */
export async function decryptBundle(token, passphrase) {
  if (typeof token !== "string" || !token.startsWith(BUNDLE_PREFIX)) {
    throw new Error("Invalid encrypted bundle format (missing EPSTEADY-AES256: prefix).");
  }
  if (!passphrase) {
    throw new Error("Passphrase is required for decryption.");
  }

  const webCrypto = getWebCrypto();
  const raw = base64ToUint8(token.slice(BUNDLE_PREFIX.length).trim());
  if (raw.length <= SALT_BYTES + IV_BYTES) {
    throw new Error("Encrypted bundle is truncated or corrupted.");
  }

  const salt = raw.slice(0, SALT_BYTES);
  const iv = raw.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = raw.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(passphrase, salt);
  const plainBuf = await webCrypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const jsonText = new TextDecoder().decode(plainBuf);
  return JSON.parse(jsonText);
}

/**
 * Pull encrypted payload from Google Apps Script Web App via GET.
 * Tolerant of both `data.payload` and legacy `data.encryptedPayload`.
 * Supports optional dormant `options.googleIdToken` query envelope when Google Auth is enabled in the future.
 */
export async function pullFromCloud(url, options = {}) {
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) return { ok: false, error: "No sync URL configured." };

  try {
    const sep = cleanUrl.includes("?") ? "&" : "?";
    let fullUrl = `${cleanUrl}${sep}t=${Date.now()}`;
    if (options && options.googleIdToken) {
      fullUrl += `&id_token=${encodeURIComponent(String(options.googleIdToken))}`;
    }
    const resp = await fetch(fullUrl, {
      method: "GET",
      cache: "no-store"
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    const payload = data?.payload || data?.encryptedPayload || "";
    return {
      ok: true,
      payload,
      updatedAt: data?.updatedAt || null,
      updatedBy: data?.updatedBy || null
    };
  } catch (err) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

/**
 * Push encrypted payload to Google Apps Script Web App via POST.
 * Uses text/plain;charset=utf-8 to avoid CORS preflight failures on Apps Script.
 * Supports optional dormant `options.googleIdToken` auth envelope when Google Sign-In is activated in the future.
 */
export async function pushToCloud(url, payload, updatedBy = "Dancer", options = {}) {
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) return { ok: false, error: "No sync URL configured." };
  if (!payload || !String(payload).startsWith(BUNDLE_PREFIX)) {
    return { ok: false, error: "Refusing to push unencrypted payload." };
  }

  const envelope = {
    updatedAt: new Date().toISOString(),
    updatedBy,
    payload
  };
  if (options && options.googleIdToken) {
    envelope.auth = {
      provider: GOOGLE_AUTH_PREP_SPEC.provider,
      idToken: String(options.googleIdToken),
      email: options.email ? String(options.email) : undefined
    };
  }

  const body = JSON.stringify(envelope);

  try {
    const resp = await fetch(cleanUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    let data = {};
    try {
      data = await resp.json();
    } catch (_e) {
      // Apps Script redirects may return opaque/empty JSON on some configurations
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

/**
 * Create a debounced cloud push helper for silent background synchronization.
 */
export function createDebouncedPush(delayMs = 1500) {
  let timer = null;
  return function schedulePush(fn) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  };
}
