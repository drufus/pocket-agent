/**
 * Multi-persona system types
 *
 * Defines the core entities for persona management, routing,
 * onboarding, and CRUD operations.
 */

// ---------------------------------------------------------------------------
// Core entity: Persona (maps to `personas` DB table)
// ---------------------------------------------------------------------------

export interface Persona {
  /** Unique identifier, e.g. 'chief-of-staff' */
  id: string;
  /** Human-readable name, e.g. 'Chief of Staff' */
  name: string;
  /** URL-safe slug for @mentions, e.g. 'cos' */
  slug: string;
  /** Lucide icon name, e.g. 'crown' */
  icon: string;
  /** Hex color for UI theming, e.g. '#a855f7' */
  color: string;
  /** Short role title, e.g. 'Chief of Staff & Executive Assistant' */
  role_title: string;
  /** Brief description shown in the persona selector UI */
  description: string;
  /** Full system prompt text -- the persona's personality and voice */
  identity: string;
  /** Additional behavioral instructions merged with the base prompt */
  instructions: string;
  /** Context prepended to the system prompt when this persona is active */
  system_prompt_prefix: string;
  /** True for the fallback persona (Chief of Staff) */
  is_default: boolean;
  /** When false the persona is hidden from the selector */
  is_active: boolean;
  /** Display order in the UI (lower = first) */
  sort_order: number;
  /** ISO-8601 timestamp */
  created_at: string;
  /** ISO-8601 timestamp */
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Routing: keyword-based intent matching
// ---------------------------------------------------------------------------

export interface PersonaRoutingKeyword {
  id: number;
  /** References Persona.id */
  persona_id: string;
  /** Trigger keyword, e.g. 'budget', 'fundraise' */
  keyword: string;
  /** Relative weight for scoring (default 1.0) */
  weight: number;
}

// ---------------------------------------------------------------------------
// Routing: result of resolving which persona handles a message
// ---------------------------------------------------------------------------

export interface PersonaRouteResult {
  /** The resolved persona */
  persona: Persona;
  /** How the persona was selected */
  method: 'mention' | 'intent' | 'explicit' | 'default';
  /** Confidence score from 0 (fallback) to 1 (exact match) */
  confidence: number;
  /** Message with the @mention stripped out (only set when method is 'mention') */
  strippedMessage?: string;
}

// ---------------------------------------------------------------------------
// Templates: seed data for generating personas
// ---------------------------------------------------------------------------

export interface PersonaTemplate {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  role_title: string;
  description: string;
  identity: string;
  instructions: string;
  system_prompt_prefix: string;
  is_default: boolean;
  sort_order: number;
  /** Keywords used to populate the routing_keywords table */
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Onboarding: answers collected from the setup wizard
// ---------------------------------------------------------------------------

export type StartupStage = 'idea' | 'pre-seed' | 'seed' | 'series-a' | 'growth' | 'scale';
export type FounderRole = 'technical' | 'business' | 'product' | 'generalist';

export interface OnboardingAnswers {
  startup_stage: StartupStage;
  founder_role: FounderRole;
  /** Identifiers for capability gaps, e.g. ['growth', 'finance', 'product'] */
  gaps: string[];
}

// ---------------------------------------------------------------------------
// CRUD inputs
// ---------------------------------------------------------------------------

/** Input for creating a new persona (id is optional -- auto-generated if omitted) */
export interface PersonaCreateInput {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  role_title: string;
  description: string;
  identity: string;
  instructions: string;
  system_prompt_prefix: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

/** Input for updating an existing persona (all fields optional) */
export type PersonaUpdateInput = Partial<Omit<Persona, 'created_at' | 'updated_at'>>;
