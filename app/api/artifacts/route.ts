import { NextResponse } from 'next/server';
import { validateUploadedField } from '../../../src/validation/artifact';

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();

  // Both sides are validated independently (spec Edge Cases) rather than
  // failing fast on the first bad file.
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

  return NextResponse.json({ left: left.artifact, right: right.artifact }, { status: 200 });
}
