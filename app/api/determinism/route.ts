import { NextResponse } from 'next/server';
import { validateUploadedLlbField } from '../../../src/validation/llbArtifact';
import { buildComparisonReport, buildSingleArtifactReport } from '../../../src/detect/divergence';
import { renderDeterminismDot } from '../../../src/detect/renderDot';

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();

  const [primaryResult, secondaryResult] = await Promise.all([
    validateUploadedLlbField(form, 'primary', true),
    validateUploadedLlbField(form, 'secondary', false),
  ]);

  // `required: true` for 'primary' means validateUploadedLlbField never
  // returns null for it.
  const primary = primaryResult!;

  if (!primary.ok || (secondaryResult && !secondaryResult.ok)) {
    return NextResponse.json(
      {
        errors: {
          primary: primary.ok ? null : primary.error,
          secondary: secondaryResult && !secondaryResult.ok ? secondaryResult.error : null,
        },
      },
      { status: 400 },
    );
  }

  if (!secondaryResult) {
    const report = buildSingleArtifactReport(primary.artifact);
    return NextResponse.json(
      { report, primary: { dot: renderDeterminismDot(primary.artifact, report, undefined) } },
      { status: 200 },
    );
  }

  const report = buildComparisonReport(primary.artifact, secondaryResult.artifact);
  return NextResponse.json(
    {
      report,
      primary: { dot: renderDeterminismDot(primary.artifact, report, 'left') },
      secondary: { dot: renderDeterminismDot(secondaryResult.artifact, report, 'right') },
    },
    { status: 200 },
  );
}
