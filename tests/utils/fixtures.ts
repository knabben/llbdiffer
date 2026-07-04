import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/dot');

export function readDotFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}
