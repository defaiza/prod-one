const SEED_KEY = "elizaHowSeed";

/**
 * Retrieves the persistent random seed from Local Storage.
 * If no seed exists, generates a new one using crypto.randomUUID() and saves it.
 * Handles potential exceptions during Local Storage access (e.g., in private browsing).
 * @returns {string | null} The seed string or null if Local Storage is unavailable.
 */
export function getOrGenerateSeed(): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    console.warn("Local Storage not available. Cannot get or generate seed.");
    return null;
  }

  try {
    let seed = localStorage.getItem(SEED_KEY);
    if (!seed) {
      console.log("Generating new persistence seed.");
      // Use crypto.randomUUID() for a strong random ID
      seed = crypto.randomUUID();
      localStorage.setItem(SEED_KEY, seed);
    }
    return seed;
  } catch (error) {
    console.error("Error accessing Local Storage for seed:", error);
    return null;
  }
}
