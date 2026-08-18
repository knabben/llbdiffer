import { NextResponse } from 'next/server';
import { validateUploadedLlbField } from '../../../src/validation/llbArtifact';
import { classify, buildDiffSummary } from '../../../src/compare/artifact';
import { analyzeDiff, AnalysisFailedError } from '../../../src/analysis/claude';

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

  try {
    const analysis = await analyzeDiff({ left: left.artifact, right: right.artifact, classification, summary });
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (err) {
    const message = err instanceof AnalysisFailedError ? err.message : 'AI analysis failed unexpectedly';
    return NextResponse.json({ error: { code: 'ANALYSIS_FAILED', message } }, { status: 502 });
  }
}
