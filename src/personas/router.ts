/**
 * PersonaRouter -- zero-latency message routing via keyword scoring.
 *
 * Routes incoming messages to the appropriate persona using a three-stage
 * algorithm that requires no LLM calls:
 *
 *   1. **@mention detection** -- highest priority, e.g. `@growth launch plan`
 *   2. **Intent classification** -- keyword-weighted scoring against message tokens
 *   3. **Default fallback** -- the designated default persona (e.g. Chief of Staff)
 *
 * Uses dependency injection (RouterConfig) instead of importing PersonaManager
 * directly to avoid circular dependencies. The router works with raw data.
 */

import type { Persona, PersonaRouteResult, PersonaRoutingKeyword } from './types';

// ---------------------------------------------------------------------------
// Configuration interface -- injected to avoid circular deps with PersonaManager
// ---------------------------------------------------------------------------

/** Provides the data accessors the router needs without coupling to PersonaManager. */
export interface RouterConfig {
  /** Return all personas (active and inactive). */
  getPersonas: () => Persona[];
  /** Look up a persona by its URL-safe slug. */
  getBySlug: (slug: string) => Persona | null;
  /** Return the default fallback persona (is_default === true). */
  getDefault: () => Persona | null;
  /** Return every routing keyword across all personas. */
  getAllKeywords: () => PersonaRoutingKeyword[];
}

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

/** Minimum normalised score to accept an intent match. */
const MIN_THRESHOLD = 0.15;

/** Winner must score at least this multiple of the runner-up. */
const DOMINANCE_RATIO = 1.5;

/** Minimum token length to keep after tokenisation. */
const MIN_TOKEN_LENGTH = 3;

// ---------------------------------------------------------------------------
// PersonaRouter
// ---------------------------------------------------------------------------

/**
 * Routes a user message to the best-matching persona using a fast,
 * deterministic three-stage algorithm (mention -> intent -> default).
 *
 * @example
 * ```ts
 * const router = new PersonaRouter({
 *   getPersonas: () => manager.getAllPersonas(),
 *   getBySlug:   (s) => manager.getBySlug(s),
 *   getDefault:  () => manager.getDefaultPersona(),
 *   getAllKeywords: () => manager.getAllKeywords(),
 * });
 *
 * const result = router.route('@growth what channels should we try?');
 * // => { persona: <growth-persona>, method: 'mention', confidence: 1.0, strippedMessage: '...' }
 * ```
 */
export class PersonaRouter {
  private config: RouterConfig;

  /**
   * Cached keyword lookup map.
   * `null` means the cache is cold and must be rebuilt on the next query.
   */
  private keywordCache: Map<string, Array<{ persona_id: string; weight: number }>> | null = null;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Route a message to the best-matching persona.
   *
   * @param message - The raw user message.
   * @returns The routing result including the resolved persona, method, and confidence.
   * @throws If no default persona is configured (should not happen if personas are seeded).
   */
  route(message: string): PersonaRouteResult {
    // Stage 1: @mention detection (highest priority)
    const mentionResult = this.detectMention(message);
    if (mentionResult) return mentionResult;

    // Stage 2: Intent classification via keyword scoring
    const intentResult = this.classifyIntent(message);
    if (intentResult) return intentResult;

    // Stage 3: Default fallback
    const defaultPersona = this.config.getDefault();
    if (defaultPersona) {
      return {
        persona: defaultPersona,
        method: 'default',
        confidence: 1.0,
      };
    }

    // No personas at all -- should not happen if seeded
    throw new Error('No default persona configured');
  }

  /**
   * Invalidate the keyword cache.
   *
   * Call this whenever personas or routing keywords are added, removed,
   * or updated so the next `route()` call rebuilds the lookup map.
   */
  invalidateCache(): void {
    this.keywordCache = null;
  }

  // -------------------------------------------------------------------------
  // Stage 1: @mention detection
  // -------------------------------------------------------------------------

  /**
   * Detect an `@slug` mention at the start of or within the message.
   *
   * If the mentioned slug maps to an active persona, returns a route result
   * with the `@mention` stripped from the message body.
   */
  private detectMention(message: string): PersonaRouteResult | null {
    // Match @slug at the start of the message or after whitespace
    const mentionRegex = /(?:^|\s)@(\w+)/;
    const match = message.match(mentionRegex);

    if (!match) return null;

    const slug = match[1].toLowerCase();
    const persona = this.config.getBySlug(slug);

    if (!persona || !persona.is_active) return null;

    // Strip the @mention from the message
    const strippedMessage = message.replace(mentionRegex, '').trim();

    return {
      persona,
      method: 'mention',
      confidence: 1.0,
      // Fall back to the original message if stripping left it empty
      strippedMessage: strippedMessage || message,
    };
  }

  // -------------------------------------------------------------------------
  // Stage 2: keyword-based intent classification
  // -------------------------------------------------------------------------

  /**
   * Score each persona against the message tokens using the keyword map.
   *
   * Returns the highest-scoring persona only when:
   * - The normalised score exceeds `MIN_THRESHOLD`.
   * - The winner dominates the runner-up by at least `DOMINANCE_RATIO`.
   * - The winner is **not** the default persona (that is the fallback's job).
   */
  private classifyIntent(message: string): PersonaRouteResult | null {
    const keywordMap = this.getKeywordMap();
    if (keywordMap.size === 0) return null;

    // Tokenise: lowercase, split on non-alphanumeric, drop short tokens
    const words = message
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= MIN_TOKEN_LENGTH);

    if (words.length === 0) return null;

    // Build unigrams + bigrams for multi-word keyword matching
    const phrases: string[] = [...words];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }

    // Accumulate scores per persona
    const scores = new Map<string, number>();

    for (const phrase of phrases) {
      const matches = keywordMap.get(phrase);
      if (!matches) continue;

      for (const { persona_id, weight } of matches) {
        scores.set(persona_id, (scores.get(persona_id) || 0) + weight);
      }
    }

    if (scores.size === 0) return null;

    // Rank by descending score
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const [topId, topScore] = sorted[0];
    const secondScore = sorted.length > 1 ? sorted[1][1] : 0;

    // Normalise by message length (in words) to avoid bias toward long messages
    const normalizedScore = topScore / Math.max(words.length, 1);

    // Gate: minimum confidence
    if (normalizedScore < MIN_THRESHOLD) return null;

    // Gate: dominance -- winner must clearly beat the runner-up
    if (secondScore > 0 && topScore < secondScore * DOMINANCE_RATIO) return null;

    // Gate: don't route to the default persona via intent (that is the fallback)
    const defaultPersona = this.config.getDefault();
    if (defaultPersona && topId === defaultPersona.id) return null;

    // Resolve the persona object
    const persona = this.config.getPersonas().find((p) => p.id === topId);
    if (!persona) return null;

    return {
      persona,
      method: 'intent',
      confidence: Math.min(normalizedScore, 1.0),
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Build (or return cached) keyword lookup map.
   *
   * Maps each lowercased keyword string to the list of persona IDs and
   * weights that reference it. Rebuilt lazily after `invalidateCache()`.
   */
  private getKeywordMap(): Map<string, Array<{ persona_id: string; weight: number }>> {
    if (this.keywordCache) return this.keywordCache;

    const keywords = this.config.getAllKeywords();
    const map = new Map<string, Array<{ persona_id: string; weight: number }>>();

    for (const kw of keywords) {
      const key = kw.keyword.toLowerCase();
      const entry = map.get(key);
      if (entry) {
        entry.push({ persona_id: kw.persona_id, weight: kw.weight });
      } else {
        map.set(key, [{ persona_id: kw.persona_id, weight: kw.weight }]);
      }
    }

    this.keywordCache = map;
    return map;
  }
}
