// packages/eliza.how/src/utils/assert.ts
export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    // in production, log error to console
    if (process.env.NODE_ENV !== "development") {
      console.error("Assertion Failed:", message);
    } else {
      throw new Error("Assertion Failed: " + message);
    }
  }
}
