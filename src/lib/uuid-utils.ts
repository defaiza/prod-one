import { sha1 } from "js-sha1"; // Need to add js-sha1 dependency

/**
 * Converts a Uint8Array to a hexadecimal string.
 */
const uint8ArrayToHex = (buf: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    let h = buf[i].toString(16);
    if (h.length < 2) {
      h = "0" + h;
    }
    out += h;
  }
  return out;
};

/**
 * Generates a deterministic UUID (version 5 like, using SHA-1) from a string.
 * Based on the core package's stringToUuid but uses js-sha1 for browser compatibility.
 * @param {string} inputString - The string to hash.
 * @returns {string} The generated UUID string.
 */
export function generateUUIDFromString(inputString: string): string {
  if (typeof inputString !== "string") {
    throw new TypeError("Value must be a string");
  }

  // Get SHA-1 hash bytes
  const hashBytes = sha1.array(inputString);
  const hashBuffer = new Uint8Array(hashBytes);

  // Apply version (pseudo-v5 using SHA-1) and variant (RFC4122)
  hashBuffer[6] = (hashBuffer[6] & 0x0f) | 0x50; // Version 5
  hashBuffer[8] = (hashBuffer[8] & 0x3f) | 0x80; // Variant RFC4122

  // Format as UUID
  return `${uint8ArrayToHex(hashBuffer.slice(0, 4))}-${uint8ArrayToHex(hashBuffer.slice(4, 6))}-${uint8ArrayToHex(hashBuffer.slice(6, 8))}-${uint8ArrayToHex(hashBuffer.slice(8, 10))}-${uint8ArrayToHex(hashBuffer.slice(10, 16))}`;
}

/**
 * Generates a deterministic Room ID for a specific query and user seed.
 * @param seed Unique user seed.
 * @param query The search query string.
 * @returns Deterministic UUID for the room.
 */
export function generateQueryRoomId(seed: string, query: string): string {
  // Simple sanitization and combination
  const sanitizedQuery = query.trim().toLowerCase().substring(0, 100); // Limit length
  const combinedString = `${seed}::query::${sanitizedQuery}`;
  return generateUUIDFromString(combinedString);
}
