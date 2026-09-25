import assert from 'node:assert/strict';
import test from 'node:test';

import { NimbleSearchClient } from '../src/integrations/nimble.mjs';

test('sends a bounded authenticated Nimble search and normalizes evidence', async () => {
  let request;
  const client = new NimbleSearchClient({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          results: [
            { title: 'Acme API', url: 'https://acme.example/api', description: 'Now available' },
            { title: 'Invalid', url: 'file:///tmp/private', description: 'Ignored' },
          ],
        }),
      };
    },
  });
  const results = await client.search({ query: 'Acme developer API' });
  assert.equal(request.url, 'https://sdk.nimbleway.com/v2/search');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    query: 'Acme developer API',
    max_results: 3,
    search_depth: 'lite',
  });
  assert.deepEqual(results, [{
    title: 'Acme API',
    url: 'https://acme.example/api',
    description: 'Now available',
  }]);
});

test('does not expose response bodies in Nimble errors', async () => {
  const client = new NimbleSearchClient({
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(client.search({ query: 'Acme API' }), /^Error: Nimble search returned HTTP 401$/);
});
