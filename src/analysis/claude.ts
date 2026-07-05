import Anthropic from '@anthropic-ai/sdk';
import type { Artifact } from '../models/artifact';
import type { Classification, DiffSummary } from '../compare/artifact';

const MODEL = 'claude-opus-4-8';

export interface AnalysisPromptContext {
  left: Artifact;
  right: Artifact;
  classification: Classification;
  summary: DiffSummary;
}

const SYSTEM_PROMPT =
  'You are assisting an engineer in reviewing the difference between two ' +
  'BuildKit LLB build DAGs ("left" and "right"). You are given each ' +
  "side's build steps (id and command) and a precomputed classification " +
  'of which steps/edges are shared, added (right only), or removed (left ' +
  'only). Explain in plain language what changed between the two builds ' +
  'and why it might matter. Do not invent differences beyond what is ' +
  'given, and do not restate the raw data verbatim — summarize it.';

function formatNodes(artifact: Artifact): string {
  if (artifact.nodes.length === 0) return '(no nodes)';
  return artifact.nodes.map((n) => `- ${n.id}: ${n.metadata.command}`).join('\n');
}

function formatEntries(entries: DiffSummary['added']): string {
  if (entries.length === 0) return '(none)';
  return entries.map((e) => `- [${e.kind}] ${e.ref}`).join('\n');
}

/**
 * Builds the plain-text prompt sent to Claude from data the comparison step
 * already produced. Kept as a pure function (no SDK call) so it can be unit
 * tested without a network call — see research.md.
 */
export function buildAnalysisPrompt(context: AnalysisPromptContext): string {
  return `Left build steps:
${formatNodes(context.left)}

Right build steps:
${formatNodes(context.right)}

Added (present only in the right build):
${formatEntries(context.summary.added)}

Removed (present only in the left build):
${formatEntries(context.summary.removed)}

Shared (present in both builds):
${formatEntries(context.summary.shared)}`;
}

export class AnalysisFailedError extends Error {}

/**
 * Sends the prompt to the Claude API and returns the narrative text.
 * Accepts an injected client so tests can mock `messages.create` without a
 * real network call (plan.md Constraints / research.md).
 */
export async function analyzeDiff(
  context: AnalysisPromptContext,
  client: Anthropic = new Anthropic(),
): Promise<string> {
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAnalysisPrompt(context) }],
    });
  } catch (err) {
    throw new AnalysisFailedError(err instanceof Error ? err.message : String(err));
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new AnalysisFailedError('Claude returned an empty response');
  }

  return textBlock.text;
}
