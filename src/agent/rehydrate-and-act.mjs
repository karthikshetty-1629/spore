import { validateReevaluation } from '../domain/reevaluation-validation.mjs';

export async function rehydrateAndAct({
  database,
  archive,
  reevaluator,
  spore_id,
  fresh_evidence,
  clock = () => new Date(),
}) {
  const spore = database.getSpore(spore_id);
  if (!spore) throw new Error(`spore not found: ${spore_id}`);
  if (spore.acted_at) {
    return { skipped: true, spore, action: database.getActionForSpore(spore_id) };
  }
  if (spore.status !== 'AWAKENED') throw new Error(`spore is not awakened: ${spore_id}`);
  if (!spore.archive_pointer) throw new Error(`spore has no archive pointer: ${spore_id}`);
  if (!fresh_evidence || typeof fresh_evidence.facts !== 'object') {
    throw new TypeError('fresh evidence with facts is required');
  }

  const archived = await archive.readEvidence(spore.archive_pointer);
  if (archived.spore_id !== spore_id || archived.evidence.run_id !== spore.run_id) {
    throw new Error('archive does not belong to this spore');
  }
  const context = {
    subject: spore.subject,
    historical_reason: spore.reason_dormant,
    historical_evidence: archived.evidence,
    fresh_evidence,
  };
  const decision = validateReevaluation(await reevaluator.reevaluate(context));
  const actedAt = clock().toISOString();
  const actionType = decision.eligible ? 'candidate_shortlisted' : 'candidate_rejected';
  const actionId = `action_${spore_id}`;

  database.withTransaction(() => {
    if (decision.eligible) {
      database.saveShortlistEntry({
        run_id: spore.run_id,
        subject: spore.subject,
        reason: decision.reason,
        evidence: {
          historical_archive: spore.archive_pointer,
          fresh_evidence,
        },
        updated_at: actedAt,
      });
    }
    database.recordAgentAction({
      action_id: actionId,
      run_id: spore.run_id,
      spore_id,
      subject: spore.subject,
      action_type: actionType,
      result: decision,
      created_at: actedAt,
    });
    if (!database.markSporeActed(spore_id, { acted_at: actedAt })) {
      throw new Error(`spore was already acted on: ${spore_id}`);
    }
  });

  return {
    skipped: false,
    context,
    decision,
    action: database.getActionForSpore(spore_id),
    shortlist_entry: database.getShortlistEntry(spore.run_id, spore.subject),
  };
}
