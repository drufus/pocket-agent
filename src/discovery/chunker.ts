/**
 * Pure text chunking utility for splitting documents into RAG-friendly pieces.
 *
 * Splits text into overlapping chunks sized for embedding models,
 * preserving paragraph and sentence boundaries where possible.
 */

/** Approximate characters per token for chunk size calculations. */
export const CHARS_PER_TOKEN = 4;

/**
 * Split text by word boundaries into segments that fit within maxChars.
 * Used as a last resort when a sentence exceeds the character limit.
 */
function hardSplitAtWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const segments: string[] = [];
  let current = '';

  for (const word of words) {
    if (!word) continue;

    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) {
        segments.push(current);
      }
      // If a single word exceeds maxChars, include it as its own segment
      current = word;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Split a paragraph into sentence-level pieces that fit within maxChars.
 * Falls back to word-boundary splitting for oversized sentences.
 */
function splitParagraphToFit(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) {
    return [paragraph];
  }

  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      pieces.push(sentence);
    } else {
      pieces.push(...hardSplitAtWords(sentence, maxChars));
    }
  }

  return pieces;
}

/**
 * Split a document into overlapping chunks suitable for RAG embedding.
 *
 * @param text - The document text to chunk
 * @param maxTokens - Maximum tokens per chunk (default 500)
 * @param overlap - Number of overlap tokens between chunks (default 100)
 * @returns Array of text chunks with overlap for context continuity
 */
export function chunkText(
  text: string,
  maxTokens = 500,
  overlap = 100
): string[] {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  function emitChunk(): void {
    const trimmed = currentChunk.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    // Start the next chunk with overlap from the end of the current chunk
    if (overlapChars > 0 && currentChunk.length > 0) {
      currentChunk = currentChunk.slice(-overlapChars);
    } else {
      currentChunk = '';
    }
  }

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    // Check if adding this paragraph (with separator) stays within limit
    const separator = currentChunk ? '\n\n' : '';
    const candidate = currentChunk + separator + trimmedParagraph;

    if (candidate.length <= maxChars) {
      currentChunk = candidate;
      continue;
    }

    // Paragraph doesn't fit - if we have accumulated content, check options
    if (trimmedParagraph.length <= maxChars) {
      // Paragraph fits on its own, emit current chunk and start fresh
      emitChunk();
      const separatorAfterOverlap = currentChunk ? '\n\n' : '';
      const candidateWithOverlap =
        currentChunk + separatorAfterOverlap + trimmedParagraph;

      if (candidateWithOverlap.length <= maxChars) {
        currentChunk = candidateWithOverlap;
      } else {
        // Overlap + paragraph exceeds limit; emit overlap as part of chunk
        // and just set the paragraph as current
        if (currentChunk.trim()) {
          // The overlap content is too large with this paragraph,
          // so we drop the overlap for this transition
          currentChunk = trimmedParagraph;
        } else {
          currentChunk = trimmedParagraph;
        }
      }
    } else {
      // Paragraph itself exceeds maxChars - split it into smaller pieces
      if (currentChunk.trim()) {
        emitChunk();
      }

      const pieces = splitParagraphToFit(trimmedParagraph, maxChars);

      for (const piece of pieces) {
        const sep = currentChunk ? '\n\n' : '';
        const pieceCandidate = currentChunk + sep + piece;

        if (pieceCandidate.length <= maxChars) {
          currentChunk = pieceCandidate;
        } else {
          emitChunk();
          currentChunk = currentChunk ? currentChunk + '\n\n' + piece : piece;
          if (currentChunk.length > maxChars) {
            // Edge case: overlap + piece still exceeds; just use piece alone
            currentChunk = piece;
          }
        }
      }
    }
  }

  // Emit the final chunk
  const finalTrimmed = currentChunk.trim();
  if (finalTrimmed) {
    chunks.push(finalTrimmed);
  }

  return chunks.filter((c) => c.length > 0);
}
