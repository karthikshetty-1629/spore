export const MEMORY_DECISIONS = Object.freeze({
  ACTIVE: 'ACTIVE',
  DURABLE: 'DURABLE',
  SPORE: 'SPORE',
  DISCARD: 'DISCARD',
});

function result(decision, reason, wakeCondition = null) {
  return {
    schema_version: 1,
    decision,
    reason,
    wake_condition: wakeCondition,
  };
}

/**
 * Classify a normalized observation using deterministic lifecycle rules.
 *
 * Liquid-assisted extraction can normalize raw text into this input shape.
 * The validated gate keeps this deterministic policy authoritative.
 */
export function classifyObservation(observation) {
  const scope = observation?.scope;

  if (
    observation?.is_duplicate === true
    || observation?.is_relevant === false
    || scope === 'noise'
  ) {
    return result(
      MEMORY_DECISIONS.DISCARD,
      observation?.discard_reason || 'The observation is duplicate, irrelevant, or noise.',
    );
  }

  if (scope === 'standing_rule' || scope === 'preference') {
    return result(
      MEMORY_DECISIONS.DURABLE,
      observation?.durable_reason || 'This is a standing rule or preference.',
    );
  }

  if (
    observation?.is_complete === false
    || observation?.currently_needed === true
    || observation?.eligible === true
  ) {
    return result(
      MEMORY_DECISIONS.ACTIVE,
      observation?.active_reason || 'This information is needed for current work.',
    );
  }

  if (
    scope === 'candidate_evaluation'
    && observation?.is_complete === true
    && observation?.blocker?.changeable === true
    && observation?.wake_condition
  ) {
    return result(
      MEMORY_DECISIONS.SPORE,
      observation.blocker.reason || 'A specific changeable fact currently blocks this candidate.',
      observation.wake_condition,
    );
  }

  return result(
    MEMORY_DECISIONS.DISCARD,
    observation?.discard_reason || 'No current, durable, or conditionally useful role was identified.',
  );
}
