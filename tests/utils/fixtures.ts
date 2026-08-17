import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/dot');
const LLBJSON_FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/llbjson');

export function readDotFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

export function readLlbJsonFixture(name: string): string {
  return readFileSync(path.join(LLBJSON_FIXTURES_DIR, name), 'utf8');
}
