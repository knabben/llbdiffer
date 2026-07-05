import { NextResponse } from 'next/server';
import { validateUploadedField } from '../../../src/validation/artifact';
import { classify, buildDiffSummary } from '../../../src/compare/artifact';
import { analyzeDiff, AnalysisFailedError } from '../../../src/analysis/claude';

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

  try {
    const analysis = await analyzeDiff({ left: left.artifact, right: right.artifact, classification, summary });
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (err) {
    const message = err instanceof AnalysisFailedError ? err.message : 'AI analysis failed unexpectedly';
    return NextResponse.json({ error: { code: 'ANALYSIS_FAILED', message } }, { status: 502 });
  }
}
