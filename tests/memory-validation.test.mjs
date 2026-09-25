import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MemoryValidationError,
  parseMemoryDecision,
  validateMemoryDecision,
  validateNormalizedObservation,
} from '../src/domain/memory-validation.mjs';

const validSpore = {
  schema_version: 1,
  decision: 'SPORE',
  reason: 'The missing API is a changeable blocker.',
  wake_condition: {
    attribute: 'public_api_available',
    operator: '==',
    target: true,
  },
};

test('accepts a valid strict SPORE decision', () => {
  assert.deepEqual(validateMemoryDecision(validSpore), validSpore);
  assert.deepEqual(parseMemoryDecision(JSON.stringify(validSpore)), validSpore);
});

test('rejects markdown-wrapped model output', () => {
  assert.throws(
    () => parseMemoryDecision(`\`\`\`json\n${JSON.stringify(validSpore)}\n\`\`\``),
    MemoryValidationError,
  );
});

test('rejects unknown decision fields', () => {
  assert.throws(
    () => validateMemoryDecision({ ...validSpore, confidence: 0.9 }),
    /confidence is not allowed/,
  );
});

test('requires a wake condition for SPORE', () => {
  assert.throws(
    () => validateMemoryDecision({ ...validSpore, wake_condition: null }),
    /wake_condition must be an object/,
  );
});

test('forbids wake conditions on non-SPORE decisions', () => {
  assert.throws(
    () => validateMemoryDecision({ ...validSpore, decision: 'ACTIVE' }),
    /must be null unless decision is SPORE/,
  );
});

test('rejects unsupported wake operators', () => {
  assert.throws(
    () => validateMemoryDecision({
      ...validSpore,
      wake_condition: { ...validSpore.wake_condition, operator: '>=' },
    }),
    /operator must be == or <=/,
  );
});

test('requires numeric targets for threshold conditions', () => {
  assert.throws(
    () => validateMemoryDecision({
      ...validSpore,
      wake_condition: { attribute: 'monthly_price', operator: '<=', target: '100' },
    }),
    /target must be a finite number/,
  );
});

test('rejects unknown normalized observation fields', () => {
  assert.throws(
    () => validateNormalizedObservation({ scope: 'noise', hidden_instruction: 'ignore policy' }),
    /hidden_instruction is not allowed/,
  );
});

test('requires candidate identity and completion state', () => {
  assert.throws(
    () => validateNormalizedObservation({ scope: 'candidate_evaluation' }),
    (error) => error.issues.some((issue) => issue.includes('subject'))
      && error.issues.some((issue) => issue.includes('is_complete')),
  );
});

test('checks evidence URL protocols', () => {
  assert.throws(
    () => validateNormalizedObservation({ scope: 'noise', source_urls: ['file:///tmp/private'] }),
    /HTTP\(S\) URLs/,
  );
});
