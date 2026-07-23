import { createSignal } from "solid-js";
import type { SavedResult, Word } from "./types";

/**
 * Key under which the array of saved results is stored in localStorage.
 */
const STORAGE_KEY = "parsed-results";

/**
 * Generates a unique identifier for a saved result.
 *
 * Prefers `crypto.randomUUID()` when available; falls back to a
 * timestamp + random-string concatenation in environments where the
 * Web Crypto API is not present.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Loads the persisted result array from localStorage, guarding against
 * missing keys and corrupt JSON.
 *
 * @returns The parsed array of `SavedResult` objects, or an empty array
 * if nothing has been saved yet or the data is unreadable.
 */
function loadResults(): SavedResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedResult[];
  } catch {
    return [];
  }
}

/**
 * Writes the full result array to localStorage. Errors (e.g. quota
 * exceeded) are silently swallowed — the in-memory signal remains
 * authoritative even if persistence fails.
 */
function persistResults(results: SavedResult[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch {
    /* localStorage persistence is best-effort */
  }
}

/**
 * A composable that manages the history of parsed Mandarin text results
 * via a SolidJS signal backed by localStorage.
 *
 * Results are stored as an array ordered by `timestamp` descending
 * (most recent first). Every mutation is immediately persisted.
 *
 * @returns An object with:
 *  - `results` — a reactive signal holding the full history.
 *  - `addResult` — saves a new result and returns it.
 *  - `getResult` — looks up a single result by its `id`.
 *  - `deleteResult` — removes a result by its `id` from the store
 *    and persists the updated array to localStorage.
 */
export function createResultStore(): {
  results: () => SavedResult[];
  addResult: (text: string, words: Word[]) => SavedResult;
  getResult: (id: string) => SavedResult | undefined;
  deleteResult: (id: string) => void;
} {
  const [results, setResults] = createSignal<SavedResult[]>(loadResults());

  /**
   * Creates a new `SavedResult`, prepends it to the history array, and
   * persists the updated array to localStorage.
   *
   * @param text - The original input text that was sent to the parser.
   * @param words - The parsed words returned by the backend.
   * @returns The newly created `SavedResult` (with a fresh `id` and the
   * current `timestamp`).
   */
  function addResult(text: string, words: Word[]): SavedResult {
    const newResult: SavedResult = {
      id: generateId(),
      text,
      words,
      timestamp: Date.now(),
    };
    const updated = [newResult, ...results()];
    setResults(updated);
    persistResults(updated);
    return newResult;
  }

  /**
   * Finds a saved result by its unique identifier.
   *
   * @param id - The `id` of the result to look up.
   * @returns The matching `SavedResult`, or `undefined` if not found.
   */
  function getResult(id: string): SavedResult | undefined {
    return results().find((result) => result.id === id);
  }

  /**
   * Removes a saved result from the history by its unique identifier
   * and persists the updated array to localStorage.
   *
   * If no result with the given `id` exists, the store remains unchanged
   * (the call is a no-op beyond the filter pass).
   *
   * @param id - The `id` of the result to remove.
   */
  function deleteResult(id: string): void {
    const updated = results().filter((result) => result.id !== id);
    setResults(updated);
    persistResults(updated);
  }

  return { results, addResult, getResult, deleteResult };
}
