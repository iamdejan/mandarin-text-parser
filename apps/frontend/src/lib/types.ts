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
