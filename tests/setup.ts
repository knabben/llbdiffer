import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// RTL's automatic cleanup only self-registers when `afterEach` is a true
// global; this project doesn't enable vitest's `test.globals`, so it must
// be wired explicitly or DOM from one test leaks into the next.
afterEach(() => {
  cleanup();
});
