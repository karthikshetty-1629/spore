import { MEMORY_DECISIONS } from '../memory/policy.mjs';

const SCOPES = new Set([
  'candidate_evaluation',
  'standing_rule',
  'preference',
  'task_state',
  'noise',
]);
const OPERATORS = new Set(['==', '<=']);
const DECISIONS = new Set(Object.values(MEMORY_DECISIONS));

export class MemoryValidationError extends Error {
  constructor(label, issues) {
    super(`${label} failed validation: ${issues.join('; ')}`);
    this.name = 'MemoryValidationError';
    this.issues = issues;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, path, issues) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`${path}.${key} is not allowed`);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateWakeCondition(value, path, issues) {
  if (!isObject(value)) {
    issues.push(`${path} must be an object`);
    return;
  }

  exactKeys(value, new Set(['attribute', 'operator', 'target']), path, issues);
  if (!nonEmptyString(value.attribute) || !/^[a-z][a-z0-9_]*$/.test(value.attribute)) {
    issues.push(`${path}.attribute must be a non-empty snake_case identifier`);
  }
  if (!OPERATORS.has(value.operator)) {
    issues.push(`${path}.operator must be == or <=`);
  }
  if (value.operator === '==' && typeof value.target !== 'boolean' && !Number.isFinite(value.target)) {
    issues.push(`${path}.target must be a boolean or finite number for ==`);
  }
  if (value.operator === '<=' && !Number.isFinite(value.target)) {
    issues.push(`${path}.target must be a finite number for <=`);
  }
}

export function validateNormalizedObservation(value) {
  const issues = [];
  if (!isObject(value)) {
    throw new MemoryValidationError('Normalized observation', ['root must be an object']);
  }

  exactKeys(value, new Set([
    'scope',
    'subject',
    'is_duplicate',
    'is_relevant',
    'is_complete',
    'currently_needed',
    'eligible',
    'blocker',
    'wake_condition',
    'discard_reason',
    'durable_reason',
    'active_reason',
    'raw_text',
    'source_urls',
    'observed_at',
  ]), 'observation', issues);

  if (!SCOPES.has(value.scope)) issues.push('observation.scope is invalid');
  if (value.scope === 'candidate_evaluation' && !nonEmptyString(value.subject)) {
    issues.push('observation.subject is required for a candidate evaluation');
  }

  for (const key of ['is_duplicate', 'is_relevant', 'is_complete', 'currently_needed', 'eligible']) {
    if (key in value && typeof value[key] !== 'boolean') {
      issues.push(`observation.${key} must be a boolean`);
    }
  }
  if (value.scope === 'candidate_evaluation' && typeof value.is_complete !== 'boolean') {
    issues.push('observation.is_complete is required for a candidate evaluation');
  }
  if (value.scope === 'task_state' && typeof value.is_complete !== 'boolean') {
    issues.push('observation.is_complete is required for task state');
  }

  for (const key of ['discard_reason', 'durable_reason', 'active_reason', 'raw_text']) {
    if (key in value && !nonEmptyString(value[key])) {
      issues.push(`observation.${key} must be a non-empty string`);
    }
  }

  if ('blocker' in value) {
    if (!isObject(value.blocker)) {
      issues.push('observation.blocker must be an object');
    } else {
      exactKeys(value.blocker, new Set(['changeable', 'reason']), 'observation.blocker', issues);
      if (typeof value.blocker.changeable !== 'boolean') {
        issues.push('observation.blocker.changeable must be a boolean');
      }
      if (!nonEmptyString(value.blocker.reason)) {
        issues.push('observation.blocker.reason must be a non-empty string');
      }
    }
  }

  if ('wake_condition' in value) {
    validateWakeCondition(value.wake_condition, 'observation.wake_condition', issues);
  }
  if (value.blocker?.changeable === true && !value.wake_condition) {
    issues.push('observation.wake_condition is required for a changeable blocker');
  }
  if (value.wake_condition && value.blocker?.changeable !== true) {
    issues.push('observation.wake_condition requires a changeable blocker');
  }

  if ('source_urls' in value) {
    if (!Array.isArray(value.source_urls) || value.source_urls.some((url) => {
      try {
        return !['http:', 'https:'].includes(new URL(url).protocol);
      } catch {
        return true;
      }
    })) {
      issues.push('observation.source_urls must contain only HTTP(S) URLs');
    }
  }
  if ('observed_at' in value && (!nonEmptyString(value.observed_at) || Number.isNaN(Date.parse(value.observed_at)))) {
    issues.push('observation.observed_at must be an ISO-compatible timestamp');
  }

  if (issues.length) throw new MemoryValidationError('Normalized observation', issues);
  return value;
}

export function validateMemoryDecision(value) {
  const issues = [];
  if (!isObject(value)) {
    throw new MemoryValidationError('Memory decision', ['root must be an object']);
  }

  exactKeys(
    value,
    new Set(['schema_version', 'decision', 'reason', 'wake_condition']),
    'decision',
    issues,
  );
  if (value.schema_version !== 1) issues.push('decision.schema_version must equal 1');
  if (!DECISIONS.has(value.decision)) issues.push('decision.decision is invalid');
  if (!nonEmptyString(value.reason)) issues.push('decision.reason must be a non-empty string');

  if (value.decision === MEMORY_DECISIONS.SPORE) {
    validateWakeCondition(value.wake_condition, 'decision.wake_condition', issues);
  } else if (value.wake_condition !== null) {
    issues.push('decision.wake_condition must be null unless decision is SPORE');
  }

  if (issues.length) throw new MemoryValidationError('Memory decision', issues);
  return value;
}

export function parseMemoryDecision(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MemoryValidationError('Memory decision', ['response must be plain JSON']);
  }
  return validateMemoryDecision(parsed);
}
