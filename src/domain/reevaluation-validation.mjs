export function validateReevaluation(value) {
  const allowed = new Set(['schema_version', 'eligible', 'reason']);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('reevaluation must be an object');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`reevaluation.${key} is not allowed`);
  }
  if (value.schema_version !== 1) throw new TypeError('reevaluation.schema_version must equal 1');
  if (typeof value.eligible !== 'boolean') throw new TypeError('reevaluation.eligible must be a boolean');
  if (typeof value.reason !== 'string' || value.reason.trim() === '') {
    throw new TypeError('reevaluation.reason must be a non-empty string');
  }
  return value;
}

export function parseReevaluation(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new TypeError('reevaluation response must be plain JSON');
  }
  return validateReevaluation(value);
}
