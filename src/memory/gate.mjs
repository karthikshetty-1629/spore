import {
  validateMemoryDecision,
  validateNormalizedObservation,
} from '../domain/memory-validation.mjs';
import { classifyObservation } from './policy.mjs';

export function evaluateObservation(observation) {
  const normalized = validateNormalizedObservation(observation);
  return validateMemoryDecision(classifyObservation(normalized));
}
