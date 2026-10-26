import { describe, expect, it } from 'vitest';
import { runAllApiTests } from './test-runner';

describe('Comprehensive End-to-End API Test Suite', () => {
  it('should execute and pass all automated API lifecycle tests', async () => {
    const results = await runAllApiTests();

    expect(results.length).toBeGreaterThanOrEqual(30);

    for (const r of results) {
      expect(
        r.statusText,
        `Step ${r.step} (${r.method} ${r.api}) failed: ${r.details}`
      ).toBe('PASS');
      expect(r.actualStatus).toBe(r.expectedStatus);
    }
  });
});
