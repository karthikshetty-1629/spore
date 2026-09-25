import { validateReevaluation } from '../domain/reevaluation-validation.mjs';
import { evaluateWakeCondition } from '../watcher/conditions.mjs';

export class DeterministicReevaluator {
  async reevaluate(context) {
    const requirements = context.historical_evidence?.payload?.requirements;
    const oldFacts = context.historical_evidence?.payload?.observed_facts || {};
    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw new Error('archived evidence must contain provider requirements');
    }
    const facts = { ...oldFacts, ...context.fresh_evidence.facts };
    const evaluations = requirements.map((requirement) => ({
      requirement,
      ...evaluateWakeCondition(requirement, facts),
    }));
    const eligible = evaluations.every((evaluation) => evaluation.matched);
    const failed = evaluations.filter((evaluation) => !evaluation.matched);
    return validateReevaluation({
      schema_version: 1,
      eligible,
      reason: eligible
        ? 'All provider requirements are now satisfied.'
        : `${failed.length} provider requirement(s) remain unsatisfied.`,
    });
  }
}
