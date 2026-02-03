/**
 * File processing utilities for the identity interview system.
 *
 * Handles PDF text extraction and meeting transcript parsing
 * for Fathom and Fireflies formats.
 */

interface FathomSegment {
  speaker?: string;
  text?: string;
  start?: number;
  end?: number;
}

interface FirefliesSentence {
  speaker_name?: string;
  text?: string;
}

const MAX_FALLBACK_LENGTH = 10_000;

/**
 * Extract text content from a base64-encoded PDF.
 *
 * Dynamically imports pdf-parse to avoid bundling issues
 * when the package is not available.
 */
export async function extractPdfText(base64Data: string): Promise<string> {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('extractPdfText: base64Data must be a non-empty string');
  }

  let parse: (buf: Buffer) => Promise<{ text: string }>;
  try {
    // pdf-parse uses `export =` (CJS). Dynamic import with esModuleInterop
    // may or may not wrap it in a `default` property depending on the bundler,
    // so we handle both cases at runtime.
    const mod = await import('pdf-parse');
    const fn = (mod as Record<string, unknown>).default ?? mod;
    parse = fn as (buf: Buffer) => Promise<{ text: string }>;
  } catch {
    throw new Error(
      'extractPdfText: pdf-parse package is not installed. Run: npm install pdf-parse'
    );
  }

  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new Error('extractPdfText: decoded PDF buffer is empty');
  }

  try {
    const result = await parse(buffer);
    return result.text;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`extractPdfText: failed to parse PDF - ${message}`);
  }
}

/**
 * Format an array of speaker/text segments into readable text.
 */
function formatSpeakerLines(
  segments: Array<{ speaker?: string; text?: string }>
): string {
  return segments
    .filter((s) => s && typeof s.text === 'string' && s.text.trim())
    .map((s) => {
      const speaker = s.speaker ?? 'Unknown';
      return `${speaker}: ${s.text!.trim()}`;
    })
    .join('\n');
}

/**
 * Truncate a string to a maximum length, appending an indicator if truncated.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '\n... [truncated]';
}

/**
 * Safely parse a JSON string, returning null on failure.
 */
function safeParse(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Parse a Fathom meeting transcript from JSON.
 *
 * Supports common Fathom export formats:
 * - `{ transcript: [{ speaker, text, start, end }] }`
 * - `{ segments: [{ speaker, text }] }`
 *
 * Falls back to truncated raw JSON if the format is unrecognized.
 */
export function parseFathomTranscript(jsonStr: string): string {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return '';
  }

  const data = safeParse(jsonStr);
  if (!data || typeof data !== 'object') {
    return truncate(jsonStr, MAX_FALLBACK_LENGTH);
  }

  const obj = data as Record<string, unknown>;

  // Format 1: { transcript: [{ speaker, text, start, end }] }
  if (Array.isArray(obj.transcript)) {
    const lines = formatSpeakerLines(
      obj.transcript as FathomSegment[]
    );
    if (lines) return lines;
  }

  // Format 2: { segments: [{ speaker, text }] }
  if (Array.isArray(obj.segments)) {
    const lines = formatSpeakerLines(
      obj.segments as FathomSegment[]
    );
    if (lines) return lines;
  }

  return truncate(JSON.stringify(data, null, 2), MAX_FALLBACK_LENGTH);
}

/**
 * Parse a Fireflies meeting transcript from JSON.
 *
 * Supports common Fireflies export formats:
 * - `{ sentences: [{ speaker_name, text }] }`
 * - `{ transcript: string }`
 *
 * Falls back to truncated raw JSON if the format is unrecognized.
 */
export function parseFirefliesTranscript(jsonStr: string): string {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return '';
  }

  const data = safeParse(jsonStr);
  if (!data || typeof data !== 'object') {
    return truncate(jsonStr, MAX_FALLBACK_LENGTH);
  }

  const obj = data as Record<string, unknown>;

  // Format 1: { sentences: [{ speaker_name, text }] }
  if (Array.isArray(obj.sentences)) {
    const lines = (obj.sentences as FirefliesSentence[])
      .filter(
        (s) => s && typeof s.text === 'string' && s.text.trim()
      )
      .map((s) => {
        const speaker = s.speaker_name ?? 'Unknown';
        return `${speaker}: ${s.text!.trim()}`;
      })
      .join('\n');
    if (lines) return lines;
  }

  // Format 2: { transcript: string }
  if (typeof obj.transcript === 'string' && obj.transcript.trim()) {
    return obj.transcript.trim();
  }

  return truncate(JSON.stringify(data, null, 2), MAX_FALLBACK_LENGTH);
}

/**
 * Auto-detect whether a transcript JSON string is Fathom or Fireflies format.
 *
 * Detection heuristics:
 * - Fathom: has `transcript` array with objects containing `start`/`end`, or has `segments` array
 * - Fireflies: has `sentences` array with objects containing `speaker_name`
 */
export function detectTranscriptFormat(
  jsonStr: string
): 'fathom' | 'fireflies' | 'unknown' {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return 'unknown';
  }

  const data = safeParse(jsonStr);
  if (!data || typeof data !== 'object') {
    return 'unknown';
  }

  const obj = data as Record<string, unknown>;

  // Check Fathom: transcript array with start/end timestamps
  if (Array.isArray(obj.transcript) && obj.transcript.length > 0) {
    const first = obj.transcript[0] as Record<string, unknown> | null;
    if (
      first &&
      typeof first === 'object' &&
      ('start' in first || 'end' in first)
    ) {
      return 'fathom';
    }
  }

  // Check Fathom: segments array
  if (Array.isArray(obj.segments) && obj.segments.length > 0) {
    return 'fathom';
  }

  // Check Fireflies: sentences array with speaker_name
  if (Array.isArray(obj.sentences) && obj.sentences.length > 0) {
    const first = obj.sentences[0] as Record<string, unknown> | null;
    if (first && typeof first === 'object' && 'speaker_name' in first) {
      return 'fireflies';
    }
  }

  return 'unknown';
}

/**
 * Auto-detect transcript format and parse accordingly.
 *
 * Delegates to the appropriate parser based on detected format.
 * For unknown formats, returns a truncated JSON string fallback.
 */
export function parseTranscript(jsonStr: string): string {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return '';
  }

  const format = detectTranscriptFormat(jsonStr);

  switch (format) {
    case 'fathom':
      return parseFathomTranscript(jsonStr);
    case 'fireflies':
      return parseFirefliesTranscript(jsonStr);
    case 'unknown': {
      const data = safeParse(jsonStr);
      if (data) {
        return truncate(
          JSON.stringify(data, null, 2),
          MAX_FALLBACK_LENGTH
        );
      }
      return truncate(jsonStr, MAX_FALLBACK_LENGTH);
    }
  }
}
