import { NextResponse } from 'next/server';
import { isSupportedDotFile, validateAndAdapt, type ArtifactResult } from '../../../src/validation/artifact';

// Per research.md: reasonable default cap to bound parse time/memory.
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

type FieldName = 'left' | 'right';

async function processField(form: FormData, field: FieldName): Promise<ArtifactResult> {
  const value = form.get(field);

  if (!(value instanceof File)) {
    return { ok: false, error: { code: 'MISSING_FILE', message: `Missing required '${field}' file` } };
  }

  if (value.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', message: `'${field}' exceeds the ${MAX_FILE_SIZE_BYTES} byte upload limit` },
    };
  }

  if (!isSupportedDotFile(value.name, value.type)) {
    return {
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', message: `'${field}' is not a recognized .dot file` },
    };
  }

  const dotText = await value.text();
  return validateAndAdapt(dotText);
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();

  // Both sides are validated independently (spec Edge Cases) rather than
  // failing fast on the first bad file.
  const [left, right] = await Promise.all([processField(form, 'left'), processField(form, 'right')]);

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
