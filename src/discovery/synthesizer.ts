/**
 * Synthesizer - Direct Claude API calls for identity/instructions generation
 *
 * Makes API calls during onboarding (before the agent is initialized) to
 * synthesize personalized identity.md and CLAUDE.md from interview data.
 */

import { SettingsManager } from '../settings';

// --- Types ---

export interface InterviewData {
  basics: {
    name: string;
    location: string;
    timezone: string;
    occupation: string;
    company: string;
  };
  story: {
    background: string;
    motivation: string;
    challenge: string;
  };
  communication: {
    tone: string | null;
    annoyances: string[];
    detailLevel: string | null;
  };
  documentTexts?: string;
}

export interface SynthesisResult {
  identity: string;
  instructions: string;
}

interface ApiCredentials {
  type: 'api_key' | 'oauth';
  value: string;
}

interface ClaudeApiResponse {
  content: Array<{ type: string; text?: string }>;
  error?: { message: string };
}

// --- Constants ---

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;
const ANTHROPIC_VERSION = '2023-06-01';
const DOCUMENT_CHAR_LIMIT = 8000;

// --- Prompt Templates ---

const IDENTITY_SYSTEM_PROMPT = `You are generating a personalized identity.md file for an AI assistant called Pocket Agent. This file defines the assistant's personality and relationship with its user.

Write in first person as the AI assistant. Be warm but not sycophantic. Match the tone preference provided.

Output ONLY the markdown content with these sections:
## Vibe
A 2-3 sentence personality statement. Calibrate formality to the user's tone preference.

## About Your Human
A 3-5 sentence summary of who this person is, what they do, what drives them, and what they're working through. Use their actual name.

## Dont
A bulleted list of 3-6 specific behaviors to avoid, derived from the user's stated annoyances and communication preferences.

Keep total output between 200-400 words. No preamble, no explanation - just the markdown.`;

const INSTRUCTIONS_SYSTEM_PROMPT = `You are generating a CLAUDE.md instructions file for an AI assistant called Pocket Agent. This file controls how the assistant behaves and responds.

Output ONLY the markdown content with these sections:
## Memory
2-3 bullet points about what to remember and prioritize about this user. Reference specific details from their profile.

## Response Style
3-5 bullet points defining how to communicate. Calibrate to the user's detail level preference and tone. Include specific anti-patterns based on their stated annoyances.

## Proactive Behavior
2-4 bullet points about when and how to proactively help, based on their occupation, challenges, and goals.

Keep total output between 300-500 words. No preamble, no explanation - just the markdown.`;

const DOCUMENT_CONTEXT_ADDENDUM = `

The user also provided documents that reveal additional context about their work, interests, or communication style. Use signals from these documents to enrich your output - reference specific projects, terminology, or patterns you notice. Here are the document contents:

<documents>
{DOCUMENT_TEXT}
</documents>`;

// --- Functions ---

/**
 * Retrieve API credentials from SettingsManager.
 * Supports both API key and OAuth token authentication.
 */
function getApiCredentials(): ApiCredentials {
  const authMethod = SettingsManager.get('auth.method');

  if (authMethod === 'oauth') {
    const token = SettingsManager.get('auth.oauthToken');
    if (!token) {
      throw new Error('OAuth token not found. Please authenticate before running synthesis.');
    }
    return { type: 'oauth', value: token };
  }

  const apiKey = SettingsManager.get('anthropic.apiKey');
  if (!apiKey) {
    throw new Error('Anthropic API key not found. Please configure authentication before running synthesis.');
  }
  return { type: 'api_key', value: apiKey };
}

/**
 * Make a direct API call to Claude and return the response text.
 * Handles both API key and OAuth authentication methods.
 */
async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const credentials = getApiCredentials();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
  };

  if (credentials.type === 'oauth') {
    headers['Authorization'] = `Bearer ${credentials.value}`;
  } else {
    headers['x-api-key'] = credentials.value;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage = (errorBody as ClaudeApiResponse | null)?.error?.message
      || `API request failed with status ${response.status}`;
    throw new Error(`Claude API error: ${errorMessage}`);
  }

  const data = (await response.json()) as ClaudeApiResponse;

  const textBlock = data.content?.find((block) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Claude API returned no text content in response.');
  }

  return textBlock.text;
}

/**
 * Format all interview data into a structured message for Claude.
 * Includes document texts (truncated) when available.
 */
function buildInterviewContext(data: InterviewData): string {
  const sections: string[] = [];

  // Basics
  sections.push('## User Profile');
  sections.push(`- Name: ${data.basics.name}`);
  sections.push(`- Location: ${data.basics.location}`);
  sections.push(`- Timezone: ${data.basics.timezone}`);
  sections.push(`- Occupation: ${data.basics.occupation}`);
  if (data.basics.company) {
    sections.push(`- Company: ${data.basics.company}`);
  }

  // Story
  sections.push('');
  sections.push('## Their Story');
  sections.push(`- Background: ${data.story.background}`);
  sections.push(`- Motivation for using an AI assistant: ${data.story.motivation}`);
  sections.push(`- Current challenge they want help with: ${data.story.challenge}`);

  // Communication preferences
  sections.push('');
  sections.push('## Communication Preferences');
  if (data.communication.tone) {
    sections.push(`- Preferred tone: ${data.communication.tone}`);
  }
  if (data.communication.detailLevel) {
    sections.push(`- Detail level: ${data.communication.detailLevel}`);
  }
  if (data.communication.annoyances.length > 0) {
    sections.push(`- Things that annoy them: ${data.communication.annoyances.join(', ')}`);
  }

  return sections.join('\n');
}

/**
 * Synthesize personalized identity.md and CLAUDE.md instructions from interview data.
 *
 * Makes two parallel Claude API calls - one for identity, one for instructions.
 * Both calls receive the same interview context but different system prompts.
 */
export async function synthesizeIdentity(data: InterviewData): Promise<SynthesisResult> {
  const interviewContext = buildInterviewContext(data);

  // Build document addendum if documents were provided
  let documentAddendum = '';
  if (data.documentTexts && data.documentTexts.trim().length > 0) {
    const truncated = data.documentTexts.length > DOCUMENT_CHAR_LIMIT
      ? data.documentTexts.slice(0, DOCUMENT_CHAR_LIMIT) + '\n\n[... truncated for length]'
      : data.documentTexts;
    documentAddendum = DOCUMENT_CONTEXT_ADDENDUM.replace('{DOCUMENT_TEXT}', truncated);
  }

  const identitySystemPrompt = IDENTITY_SYSTEM_PROMPT + documentAddendum;
  const instructionsSystemPrompt = INSTRUCTIONS_SYSTEM_PROMPT + documentAddendum;

  // Run both synthesis calls in parallel
  const [identity, instructions] = await Promise.all([
    callClaude(identitySystemPrompt, interviewContext),
    callClaude(instructionsSystemPrompt, interviewContext),
  ]);

  return { identity, instructions };
}
