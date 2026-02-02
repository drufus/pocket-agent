/**
 * PersonaManager — singleton CRUD wrapper around MemoryManager persona methods.
 *
 * Provides an in-memory cache layer and a `seedDefaults()` method to populate
 * initial personas from templates (or from onboarding answers).
 *
 * Follows the same singleton pattern as SettingsManager.
 */

import type { MemoryManager } from '../memory';
import type { Persona, PersonaCreateInput, PersonaUpdateInput, OnboardingAnswers } from './types';
import { getDefaultTemplates } from './templates';
import { generatePersonas } from './generator';

class PersonaManagerClass {
  private static instance: PersonaManagerClass | null = null;
  private memory: MemoryManager | null = null;
  private cache: Persona[] | null = null;
  private initialized = false;

  private constructor() {}

  /** Get or create the singleton instance. */
  static getInstance(): PersonaManagerClass {
    if (!PersonaManagerClass.instance) {
      PersonaManagerClass.instance = new PersonaManagerClass();
    }
    return PersonaManagerClass.instance;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Wire up the MemoryManager dependency.
   * Must be called once during app startup before any other method.
   */
  initialize(memory: MemoryManager): void {
    this.memory = memory;
    this.initialized = true;
    this.invalidateCache();
    console.log('[Personas] PersonaManager initialized');
  }

  /** Whether `initialize()` has been called. */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  /** Drop the in-memory cache so the next read hits the DB. */
  private invalidateCache(): void {
    this.cache = null;
  }

  /** Throw if the manager has not been initialized yet. */
  private ensureInitialized(): void {
    if (!this.memory) {
      throw new Error('PersonaManager not initialized — call initialize(memory) first');
    }
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * Return all personas.
   * @param activeOnly - When true (default) only active personas are returned.
   */
  getAll(activeOnly = true): Persona[] {
    this.ensureInitialized();

    if (!this.cache) {
      this.cache = this.memory!.getPersonas(false);
    }

    return activeOnly
      ? this.cache.filter((p) => p.is_active)
      : this.cache;
  }

  /**
   * Find a persona by its primary-key id.
   * Returns from cache when available, falls back to DB.
   */
  getById(id: string): Persona | null {
    this.ensureInitialized();

    const cached = this.cache?.find((p) => p.id === id);
    if (cached) return cached;

    return this.memory!.getPersonaById(id);
  }

  /**
   * Find a persona by its unique slug (used for @mentions).
   * Returns from cache when available, falls back to DB.
   */
  getBySlug(slug: string): Persona | null {
    this.ensureInitialized();

    const cached = this.cache?.find((p) => p.slug === slug);
    if (cached) return cached;

    return this.memory!.getPersonaBySlug(slug);
  }

  /**
   * Return the default persona (is_default && is_active).
   * Returns from cache when available, falls back to DB.
   */
  getDefault(): Persona | null {
    this.ensureInitialized();

    const cached = this.cache?.find((p) => p.is_default && p.is_active);
    if (cached) return cached;

    return this.memory!.getDefaultPersona();
  }

  /** True when at least one persona exists in the database. */
  hasPersonas(): boolean {
    return this.getAll(false).length > 0;
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new persona.
   * If `input.id` is omitted a slug-style id is derived from the name.
   * Returns the freshly-persisted Persona (with timestamps from the DB).
   */
  create(input: PersonaCreateInput): Persona {
    this.ensureInitialized();

    const id = input.id || this.generateId(input.name);

    const persona: Omit<Persona, 'created_at' | 'updated_at'> = {
      id,
      name: input.name,
      slug: input.slug,
      icon: input.icon || 'briefcase',
      color: input.color || '#a855f7',
      role_title: input.role_title,
      description: input.description,
      identity: input.identity,
      instructions: input.instructions || '',
      system_prompt_prefix: input.system_prompt_prefix || '',
      is_default: input.is_default || false,
      is_active: input.is_active !== undefined ? input.is_active : true,
      sort_order: input.sort_order || 0,
    };

    this.memory!.savePersona(persona);
    this.invalidateCache();

    // Return the DB row so callers get created_at / updated_at
    return this.memory!.getPersonaById(id)!;
  }

  /**
   * Partially update an existing persona.
   * Returns true when the row was changed.
   */
  update(id: string, updates: PersonaUpdateInput): boolean {
    this.ensureInitialized();

    const result = this.memory!.updatePersona(id, updates);
    if (result) {
      this.invalidateCache();
    }
    return result;
  }

  /**
   * Delete a persona by id.
   * Routing keywords are removed automatically via ON DELETE CASCADE.
   * Returns true when the row was removed.
   */
  delete(id: string): boolean {
    this.ensureInitialized();

    const result = this.memory!.deletePersona(id);
    if (result) {
      this.invalidateCache();
    }
    return result;
  }

  /**
   * Set a persona as the default, clearing the flag on all others.
   */
  setDefault(id: string): void {
    this.ensureInitialized();

    this.memory!.setDefaultPersona(id);
    this.invalidateCache();
  }

  // ---------------------------------------------------------------------------
  // Seeding
  // ---------------------------------------------------------------------------

  /**
   * Populate the database with default personas from templates.
   *
   * When `answers` are provided the templates are generated from the user's
   * onboarding responses (startup stage, role, gaps). Otherwise the full set
   * of 8 default founder personas is used.
   *
   * This is a no-op if personas already exist — safe to call on every launch.
   */
  seedDefaults(answers?: OnboardingAnswers): void {
    this.ensureInitialized();

    if (this.hasPersonas()) {
      console.log('[Personas] Personas already exist, skipping seed');
      return;
    }

    const templates = answers
      ? generatePersonas(answers)
      : getDefaultTemplates();

    console.log(`[Personas] Seeding ${templates.length} default personas`);

    for (const template of templates) {
      const persona: Omit<Persona, 'created_at' | 'updated_at'> = {
        id: template.id,
        name: template.name,
        slug: template.slug,
        icon: template.icon,
        color: template.color,
        role_title: template.role_title,
        description: template.description,
        identity: template.identity,
        instructions: template.instructions,
        system_prompt_prefix: template.system_prompt_prefix,
        is_default: template.is_default,
        is_active: true,
        sort_order: template.sort_order,
      };

      this.memory!.savePersona(persona);

      if (template.keywords.length > 0) {
        this.memory!.setRoutingKeywords(
          template.id,
          template.keywords.map((k) => ({ keyword: k, weight: 1.0 })),
        );
      }
    }

    this.invalidateCache();
    console.log('[Personas] Seed complete');
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Derive a URL-safe id from a human-readable name.
   * "Chief of Staff" -> "chief-of-staff"
   */
  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

/** Singleton PersonaManager instance. */
export const PersonaManager = PersonaManagerClass.getInstance();
