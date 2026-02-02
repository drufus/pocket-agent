/**
 * Onboarding-based persona auto-generation
 *
 * Takes {@link OnboardingAnswers} collected during the setup wizard
 * (startup stage, founder role, capability gaps) and produces a
 * customized set of {@link PersonaTemplate}s:
 *
 * 1. Chief of Staff is always included as the default persona.
 * 2. Additional personas are added based on the founder's gap selections.
 * 3. Every persona's identity and system_prompt_prefix are enriched with
 *    stage-specific context so the AI understands the startup's maturity.
 * 4. The Chief of Staff receives extra context about the founder's role
 *    so it can complement their strengths.
 */

import type {
  PersonaTemplate,
  OnboardingAnswers,
  StartupStage,
  FounderRole,
} from './types';
import { getDefaultTemplates } from './templates';

// ---------------------------------------------------------------------------
// Mapping tables
// ---------------------------------------------------------------------------

/** Maps gap selection identifiers to persona template IDs. */
const GAP_TO_PERSONA: Record<string, string> = {
  strategy: 'chief-of-staff',
  growth: 'growth-advisor',
  finance: 'finance-ops',
  product: 'product-manager',
  sales: 'sales-advisor',
  legal: 'legal-advisor',
  creative: 'creative-director',
  tech: 'cto-tech',
};

/** Stage-specific context appended to every persona's identity text. */
const STAGE_CONTEXT: Record<StartupStage, string> = {
  idea: 'The startup is at the idea stage. Focus on validation, lean experiments, finding problem-market fit, and early user discovery. Resources are extremely limited — prioritize ruthlessly.',
  'pre-seed':
    'The startup is pre-seed. Focus on MVP development, early user feedback, and preparing for initial fundraising. Help the founder iterate fast and talk to customers.',
  seed: 'The startup is seed-stage with early traction. Focus on product-market fit signals, early metrics that matter, and building the founding team. Unit economics are starting to matter.',
  'series-a':
    'The startup is Series A — growth mode activated. Focus on scaling what works, hiring key functional leaders, and establishing repeatable processes. Metrics and efficiency matter now.',
  growth:
    'The startup is in growth stage. Focus on scaling operations, expanding to new markets, building organizational structure, and maintaining culture. Execution speed is critical.',
  scale:
    'The startup is at scale. Focus on operational excellence, market leadership, and preparing for potential exit/IPO. Governance, compliance, and professional management are priorities.',
};

/** Founder role context appended to the Chief of Staff persona. */
const ROLE_CONTEXT: Record<FounderRole, string> = {
  technical:
    'The founder is technical — help them with the business/people/strategy side they may not naturally focus on. Translate business concepts into frameworks they understand.',
  business:
    'The founder is business-focused — they handle relationships and strategy well. Help them make informed technical decisions and communicate effectively with engineering.',
  product:
    'The founder is product-focused — they think deeply about users. Help them balance product vision with business pragmatism and operational needs.',
  generalist:
    'The founder is a generalist — they wear many hats. Help them identify which hat to wear when, and when to delegate or hire specialists.',
};

// ---------------------------------------------------------------------------
// Text customization helpers
// ---------------------------------------------------------------------------

/** Appends a "Startup Context" section with stage-specific guidance. */
function customizeForStage(text: string, stage: StartupStage): string {
  const context = STAGE_CONTEXT[stage];
  if (!context) return text;
  return `${text}\n\n## Startup Context\n${context}`;
}

/** Appends a "Founder Context" section with role-specific guidance. */
function customizeForFounderRole(text: string, role: FounderRole): string {
  const context = ROLE_CONTEXT[role];
  if (!context) return text;
  return `${text}\n\n## Founder Context\n${context}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a customized set of persona templates from onboarding answers.
 *
 * The returned templates are deep copies — the original template constants
 * are never mutated.
 *
 * @param answers - Onboarding answers collected from the setup wizard.
 * @returns An array of persona templates tailored to the founder's context.
 * @throws If the Chief of Staff template is missing from the defaults.
 */
export function generatePersonas(
  answers: OnboardingAnswers,
): PersonaTemplate[] {
  const allTemplates = getDefaultTemplates();

  // Chief of Staff is always included as the primary persona.
  const cosTemplate = allTemplates.find((t) => t.id === 'chief-of-staff');
  if (!cosTemplate) {
    throw new Error('Chief of Staff template not found');
  }

  const result: PersonaTemplate[] = [cosTemplate];

  // Add personas for each selected capability gap.
  for (const gap of answers.gaps) {
    const personaId = GAP_TO_PERSONA[gap];
    if (!personaId || personaId === 'chief-of-staff') continue;

    const template = allTemplates.find((t) => t.id === personaId);
    if (template && !result.find((t) => t.id === template.id)) {
      result.push(template);
    }
  }

  // Enrich all personas with stage-specific context.
  for (const persona of result) {
    persona.identity = customizeForStage(
      persona.identity,
      answers.startup_stage,
    );
    persona.system_prompt_prefix = customizeForStage(
      persona.system_prompt_prefix,
      answers.startup_stage,
    );
  }

  // Give the Chief of Staff additional founder-role context.
  cosTemplate.identity = customizeForFounderRole(
    cosTemplate.identity,
    answers.founder_role,
  );

  return result;
}

/**
 * Returns suggested capability gaps for a given startup stage.
 *
 * Useful for pre-selecting checkboxes in the onboarding UI so founders
 * see contextually relevant defaults.
 *
 * @param stage - The startup's current stage.
 * @returns An array of gap identifiers (keys of {@link GAP_TO_PERSONA}).
 */
export function getSuggestedGaps(stage: StartupStage): string[] {
  const suggestions: Record<StartupStage, string[]> = {
    idea: ['product', 'tech'],
    'pre-seed': ['product', 'tech', 'growth'],
    seed: ['growth', 'finance', 'product'],
    'series-a': ['growth', 'finance', 'sales', 'product'],
    growth: ['growth', 'finance', 'sales', 'legal'],
    scale: ['finance', 'legal', 'sales', 'growth'],
  };
  return suggestions[stage] ?? [];
}
