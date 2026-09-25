import assert from 'node:assert/strict';
import test from 'node:test';

import { LiquidReevaluationClient } from '../src/integrations/liquid.mjs';

test('requests a strict reevaluation from the selected Liquid model', async () => {
  let request;
  const client = new LiquidReevaluationClient({
    model: 'hf.co/LiquidAI/LFM2.5-8B-A1B-GGUF',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            schema_version: 1,
            eligible: true,
            reason: 'All requirements are satisfied.',
          }) } }],
        }),
      };
    },
  });
  const result = await client.reevaluate({ subject: 'Acme', fresh_evidence: { facts: {} } });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(body.model, 'hf.co/LiquidAI/LFM2.5-8B-A1B-GGUF');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(result.eligible, true);
});

test('rejects malformed Liquid reevaluation output', async () => {
  const client = new LiquidReevaluationClient({
    model: 'test-model',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"eligible":true}' } }] }),
    }),
  });
  await assert.rejects(client.reevaluate({}), /schema_version must equal 1/);
});

test('uses Ollama native structured output for local Liquid inference', async () => {
  let request;
  const client = new LiquidReevaluationClient({
    model: 'liquid-local',
    apiMode: 'ollama',
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ message: { content: '{"schema_version":1,"eligible":true,"reason":"Matched."}' } }),
      };
    },
  });
  const result = await client.reevaluate({ subject: 'Provider' });
  assert.equal(request.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(request.body.stream, false);
  assert.equal(request.body.think, false);
  assert.equal(request.body.format.type, 'object');
  assert.equal(result.eligible, true);
});
