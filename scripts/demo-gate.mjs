import { readFile } from 'node:fs/promises';

import { evaluateObservation } from '../src/memory/gate.mjs';

const cases = JSON.parse(
  await readFile(new URL('../fixtures/memory-gate-cases.json', import.meta.url), 'utf8'),
);

const rows = cases.map((scenario) => {
  const result = evaluateObservation(scenario.observation);
  return {
    observation: scenario.name,
    expected: scenario.expected,
    actual: result.decision,
    passed: result.decision === scenario.expected ? 'yes' : 'no',
    wake_condition: result.wake_condition
      ? `${result.wake_condition.attribute} ${result.wake_condition.operator} ${result.wake_condition.target}`
      : '-',
  };
});

console.table(rows);
const passed = rows.filter((row) => row.passed === 'yes').length;
console.log(`\nMemory gate: ${passed}/${rows.length} representative cases passed.`);
if (passed !== rows.length) process.exitCode = 1;
