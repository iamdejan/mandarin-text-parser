/**
 * Represents a single parsed word from the backend.
 */
export type Word = {
  /** The original Chinese characters or punctuation. */
  hanzi: string;
  /** Pinyin transcription of the word. */
  pinyin: string;
  /** English translation of the word. */
  english: string;
};

/**
 * The response body returned by `POST /text/parse`.
 */
export type ParseResponse = {
  /** Array of parsed words in document order. */
  words: Word[];
};

/**
 * A single saved parsing result persisted to localStorage.
 */
export type SavedResult = {
  /** Unique identifier for this result (UUID v4). */
  id: string;
  /** The original input text that was sent to the parser. */
  text: string;
  /** The parsed words returned by the backend. */
  words: Word[];
  /** Unix timestamp (ms) of when the result was created. */
  timestamp: number;
};
