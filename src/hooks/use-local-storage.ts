import { useState, useEffect } from "react";

/**
 * Custom hook to manage state backed by Local Storage.
 * @param key The key to use in Local Storage.
 * @param initialValue The initial value or a function to generate it if not found in Local Storage.
 * @returns A stateful value, and a function to update it.
 */
function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: T | ((val: T) => T)) => void] {
  // Get initial value from local storage or use the provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      // Return initialValue on the server
      return typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item
        ? JSON.parse(item)
        : typeof initialValue === "function"
          ? (initialValue as () => T)()
          : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(
        `Error reading localStorage key \u201C${key}\u201D:`,
        error,
      );
      return typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue;
    }
  });

  // Function to update the state and local storage
  const setValue = (value: T | ((val: T) => T)) => {
    if (typeof window === "undefined") {
      console.warn(
        `Tried setting localStorage key \u201C${key}\u201D even though environment is not a client`,
      );
      return;
    }

    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(
        `Error setting localStorage key \u201C${key}\u201D:`,
        error,
      );
    }
  };

  // Effect to update state if local storage changes from another tab/window
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          setStoredValue(
            event.newValue ? JSON.parse(event.newValue) : initialValue,
          );
        } catch (error) {
          console.error(
            `Error parsing stored value for key \u201C${key}\u201D:`,
            error,
          );
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run if key changes (shouldn't typically happen)

  return [storedValue, setValue];
}

export default useLocalStorage;
