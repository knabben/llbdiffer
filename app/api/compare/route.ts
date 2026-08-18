import { NextResponse } from 'next/server';
import { validateUploadedLlbField } from '../../../src/validation/llbArtifact';
import { classify, buildDiffSummary, isIdentical } from '../../../src/compare/artifact';
import { renderClassifiedDot } from '../../../src/adapters/dot/render';

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();

  const [leftResult, rightResult] = await Promise.all([
    validateUploadedLlbField(form, 'left', true),
    validateUploadedLlbField(form, 'right', true),
  ]);

  // `required: true` for both fields means validateUploadedLlbField never
  // returns null for either.
  const left = leftResult!;
  const right = rightResult!;

  if (!left.ok || !right.ok) {
    return NextResponse.json(
      {
        errors: {
          left: left.ok ? null : left.error,
          right: right.ok ? null : right.error,
        },
      },
      { status: 400 },
    );
  }

  const classification = classify(left.artifact, right.artifact);
  const summary = buildDiffSummary(classification);

  return NextResponse.json(
    {
      left: {
        dot: renderClassifiedDot(left.artifact, classification.left, 'removed'),
        hashes: left.artifact.nodes.map((n) => n.id),
      },
      right: {
        dot: renderClassifiedDot(right.artifact, classification.right, 'added'),
        hashes: right.artifact.nodes.map((n) => n.id),
      },
      summary,
      identical: isIdentical(summary),
    },
    { status: 200 },
  );
}
