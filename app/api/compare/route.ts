import { NextResponse } from 'next/server';
import { validateUploadedField } from '../../../src/validation/artifact';
import { classify, buildDiffSummary, isIdentical } from '../../../src/compare/artifact';
import { renderClassifiedDot } from '../../../src/adapters/dot/render';

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();

  const [left, right] = await Promise.all([
    validateUploadedField(form, 'left'),
    validateUploadedField(form, 'right'),
  ]);

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
