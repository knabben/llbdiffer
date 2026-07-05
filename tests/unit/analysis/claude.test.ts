// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  buildAnalysisPrompt,
  analyzeDiff,
  AnalysisFailedError,
  type AnalysisPromptContext,
} from '../../../src/analysis/claude';
import type { Artifact } from '../../../src/models/artifact';
import { classify, buildDiffSummary } from '../../../src/compare/artifact';

function buildContext(): AnalysisPromptContext {
  const left: Artifact = {
    schemaVersion: '1.0.0',
    nodes: [
      { id: 'sha256:aaa', label: 'FROM alpine', metadata: { command: 'FROM alpine' } },
      { id: 'sha256:bbb', label: 'RUN old', metadata: { command: 'RUN old-command' } },
    ],
    edges: [{ source: 'sha256:aaa', target: 'sha256:bbb' }],
  };
  const right: Artifact = {
    schemaVersion: '1.0.0',
    nodes: [
      { id: 'sha256:aaa', label: 'FROM alpine', metadata: { command: 'FROM alpine' } },
      { id: 'sha256:ccc', label: 'RUN new', metadata: { command: 'RUN new-command' } },
    ],
    edges: [{ source: 'sha256:aaa', target: 'sha256:ccc' }],
  };
  const classification = classify(left, right);
  const summary = buildDiffSummary(classification);
  return { left, right, classification, summary };
}

function mockClient(create: (...args: unknown[]) => unknown): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

describe('buildAnalysisPrompt', () => {
  it('includes both artifacts commands and the added/removed/shared classification', () => {
    const prompt = buildAnalysisPrompt(buildContext());

    expect(prompt).toContain('sha256:aaa: FROM alpine');
    expect(prompt).toContain('sha256:bbb: RUN old-command');
    expect(prompt).toContain('sha256:ccc: RUN new-command');
    expect(prompt).toMatch(/Added \(present only in the right build\):[\s\S]*sha256:ccc/);
    expect(prompt).toMatch(/Removed \(present only in the left build\):[\s\S]*sha256:bbb/);
    expect(prompt).toMatch(/Shared \(present in both builds\):[\s\S]*sha256:aaa/);
  });
});

describe('analyzeDiff', () => {
  it('returns the narrative text from a mocked Claude response', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'The right build replaces an old command with a new one.' }],
    });

    const result = await analyzeDiff(buildContext(), mockClient(create));

    expect(result).toBe('The right build replaces an old command with a new one.');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-8', messages: expect.any(Array) }),
    );
  });

  it('throws AnalysisFailedError when the Claude call itself fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('network unreachable'));

    await expect(analyzeDiff(buildContext(), mockClient(create))).rejects.toThrow(AnalysisFailedError);
  });

  it('throws AnalysisFailedError when the response has no text content', async () => {
    const create = vi.fn().mockResolvedValue({ content: [] });

    await expect(analyzeDiff(buildContext(), mockClient(create))).rejects.toThrow(AnalysisFailedError);
  });
});
