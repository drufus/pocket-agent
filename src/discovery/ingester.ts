/**
 * Document ingestion pipeline for the RAG knowledge system.
 *
 * Chunks text documents and saves them as facts in the memory layer,
 * enabling semantic retrieval for agent context augmentation.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { chunkText } from './chunker';
import type { MemoryManager } from '../memory';

export interface IngestResult {
  chunksCreated: number;
  factIds: number[];
  savedPath: string | null;
}

/**
 * Sanitize a filename by replacing unsafe characters with underscores.
 *
 * - Replaces any character not in [a-zA-Z0-9._-] with underscore
 * - Collapses consecutive underscores
 * - Trims leading/trailing underscores
 * - Falls back to 'document' if the result is empty
 */
export function sanitizeFilename(filename: string): string {
  let sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  sanitized = sanitized.replace(/_+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  if (!sanitized) {
    return 'document';
  }

  return sanitized;
}

/**
 * Save an uploaded file to the knowledge directory.
 *
 * Files are stored in ~/Documents/Pocket-agent/knowledge/ with a
 * timestamp prefix to avoid collisions.
 *
 * @param filename - Original filename (will be sanitized)
 * @param content  - File content as string or Buffer
 * @returns Absolute path to the saved file
 * @throws If the file write fails
 */
export function saveUploadedFile(
  filename: string,
  content: string | Buffer,
): string {
  const knowledgeDir = path.join(
    app.getPath('documents'),
    'Pocket-agent',
    'knowledge',
  );

  fs.mkdirSync(knowledgeDir, { recursive: true });

  const sanitized = sanitizeFilename(filename);
  const timestamped = `${Date.now()}-${sanitized}`;
  const filePath = path.join(knowledgeDir, timestamped);

  fs.writeFileSync(filePath, content);

  return filePath;
}

/**
 * Ingest a text document into the RAG knowledge system.
 *
 * Splits the text into chunks and saves each as a fact under the
 * 'knowledge' category. Also stores source metadata as a separate
 * 'knowledge_source' fact.
 *
 * @param filename - Original document filename (used as fact subject prefix)
 * @param text     - Full text content of the document
 * @param memory   - MemoryManager instance for persisting facts
 * @returns Result with chunk count, fact IDs, and saved path
 * @throws If filename or text is empty
 */
export async function ingestDocument(
  filename: string,
  text: string,
  memory: MemoryManager,
): Promise<IngestResult> {
  if (!filename || !filename.trim()) {
    throw new Error('ingestDocument: filename must be a non-empty string');
  }

  if (!text || !text.trim()) {
    throw new Error('ingestDocument: text must be a non-empty string');
  }

  const sanitizedName = sanitizeFilename(filename);
  const chunks = chunkText(text, 500, 100);

  if (chunks.length === 0) {
    return { chunksCreated: 0, factIds: [], savedPath: null };
  }

  const factIds: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const factId = memory.saveFact(
        'knowledge',
        `${sanitizedName}:chunk_${i + 1}`,
        chunks[i],
      );
      factIds.push(factId);
    } catch (err) {
      console.warn(
        `[Ingester] Failed to save chunk ${i + 1} of ${sanitizedName}:`,
        err,
      );
    }
  }

  // Save source metadata
  try {
    memory.saveFact(
      'knowledge_source',
      sanitizedName,
      JSON.stringify({
        originalName: filename,
        characterCount: text.length,
        chunks: chunks.length,
        ingestedAt: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.warn(
      `[Ingester] Failed to save metadata for ${sanitizedName}:`,
      err,
    );
  }

  return {
    chunksCreated: factIds.length,
    factIds,
    savedPath: null,
  };
}
