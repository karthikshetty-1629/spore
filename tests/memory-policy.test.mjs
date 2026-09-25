import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { classifyObservation, MEMORY_DECISIONS } from '../src/memory/policy.mjs';

const cases = JSON.parse(
  await readFile(new URL('../fixtures/memory-gate-cases.json', import.meta.url), 'utf8'),
);

test('exports the four canonical memory decisions', () => {
  assert.deepEqual(Object.values(MEMORY_DECISIONS), [
    'ACTIVE',
    'DURABLE',
    'SPORE',
    'DISCARD',
  ]);
});

for (const scenario of cases) {
  test(`classifies ${scenario.name} as ${scenario.expected}`, () => {
    const actual = classifyObservation(scenario.observation);
    assert.equal(actual.schema_version, 1);
    assert.equal(actual.decision, scenario.expected);
    assert.ok(actual.reason);

    if (scenario.expected === 'SPORE') {
      assert.deepEqual(actual.wake_condition, scenario.observation.wake_condition);
    } else {
      assert.equal(actual.wake_condition, null);
    }
  });
}
