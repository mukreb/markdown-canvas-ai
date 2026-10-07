/**
 * BYOK (bring-your-own-key) storage. The user's Anthropic API key lives only
 * in their browser (localStorage) and is sent as a header with AI requests —
 * the server uses it for that one call and never stores it.
 */

const STORAGE_KEY = "mc-anthropic-api-key";

// Private-mode browsers may block storage; the key then lives here for the
// page load only, which is an acceptable degradation.
let memoryKey = "";

export function getApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memoryKey;
  } catch {
    return memoryKey;
  }
}

export function setApiKey(key: string): void {
  memoryKey = key;
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: memoryKey above keeps the key for this page load.
  }
}

/** Rough sanity check so we can warn on obvious paste mistakes, not validate. */
export function looksLikeAnthropicKey(key: string): boolean {
  return key.startsWith("sk-ant-") && key.length > 20;
}
