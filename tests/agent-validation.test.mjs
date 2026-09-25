import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAgentPlan, validateEvidenceAssessment } from '../src/domain/agent-validation.mjs';

test('validates a bounded multi-query agent plan', () => {
  const plan = validateAgentPlan({
    schema_version: 1, objective: 'Watch official documentation', subject: 'OpenAI Responses API',
    search_queries: ['OpenAI Responses API reference', 'site:developers.openai.com Responses API'],
    official_domains: ['developers.openai.com'],
    wake_condition: { attribute: 'api_documentation_available', operator: '==', target: true },
  });
  assert.equal(plan.search_queries.length, 2);
});

test('rejects model citations outside Nimble results or official domains', () => {
  const results = [{ title: 'Docs', description: 'API reference', url: 'https://developers.openai.com/api/reference/responses/' }];
  assert.throws(() => validateEvidenceAssessment({ schema_version: 1, condition_met: true, matched_urls: ['https://example.com/fake'], summary: 'Found.' }, results, ['openai.com']), /not returned by Nimble/);
});
