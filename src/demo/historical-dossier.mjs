const evaluationDimensions = [
  ['API surface', 'Confirm that the product exposes a documented, stable interface suitable for programmatic integration rather than requiring manual use.', 'Official reference documentation, supported endpoints, request and response examples, and an explicit authentication method.'],
  ['Authentication', 'Understand how service identities, user identities, key rotation, and least-privilege access would work in production.', 'Documented credential types, rotation guidance, scopes or project boundaries, and safe server-side usage patterns.'],
  ['Reliability', 'A long-running agent needs predictable behavior when a provider is slow, unavailable, or returns a partial response.', 'Published error shapes, timeout behavior, retry guidance, idempotency guidance, and status visibility.'],
  ['Rate limits', 'The scout may operate continuously, so the team needs to know how throughput is limited and how backoff should be implemented.', 'Official rate-limit headers, quota documentation, retry-after behavior, and account-level controls.'],
  ['Data retention', 'Archived research can contain internal evaluation context, so provider-side storage and retention behavior affects approval.', 'Clear retention defaults, available controls, deletion behavior, and enterprise data-handling documentation.'],
  ['Privacy', 'The integration must avoid sending more historical context than the action requires and must support responsible data handling.', 'Privacy terms, data-processing boundaries, opt-out controls, and guidance for sensitive application data.'],
  ['Security', 'The candidate must fit normal production security reviews and provide enough documentation for threat modeling.', 'Transport security, account controls, incident communication, security documentation, and abuse-prevention guidance.'],
  ['Observability', 'Operators need to reconstruct why an agent made a decision and which external request contributed to it.', 'Request identifiers, usage reporting, error detail, latency information, and practical hooks for application telemetry.'],
  ['Structured output', 'SPORE depends on predictable machine-readable decisions rather than free-form text that may be ambiguous.', 'A documented structured-output or schema-constrained response method with validation and failure behavior.'],
  ['Tool use', 'A research agent must be able to combine model reasoning with searches, storage, and controlled application actions.', 'Documented tool invocation, function descriptions, argument validation, and multi-step orchestration examples.'],
  ['Streaming', 'Long operations benefit from visible progress and early feedback, especially during a live demonstration or operator review.', 'Streaming event documentation, termination rules, error events, and examples for the intended SDK.'],
  ['SDK quality', 'A maintained SDK reduces custom networking code and makes retries, types, and authentication easier to implement safely.', 'Current SDK documentation, typed examples, versioning policy, installation guidance, and active maintenance signals.'],
  ['Versioning', 'The agent may run for months, so unannounced interface changes could break dormant wake actions.', 'API version guidance, deprecation policy, migration notes, changelog practices, and compatibility expectations.'],
  ['Cost control', 'Repeated research and reevaluation must stay bounded and visible rather than creating unlimited external spend.', 'Usage measurement, budget controls, pricing units, request limits, and a way to estimate worst-case run cost.'],
  ['Context capacity', 'Rehydrated evidence may be larger than a normal prompt, so the integration must define practical input constraints.', 'Published context limits, truncation behavior, file or retrieval options, and guidance for large structured inputs.'],
  ['Latency', 'The watcher and post-wake action should complete quickly enough for an operator to understand what is happening.', 'Representative latency guidance, streaming support, timeouts, and model selection options for speed-sensitive work.'],
  ['Regional availability', 'Some deployments require processing boundaries or region-specific service availability.', 'Supported regions, data location controls, service availability notes, and account configuration requirements.'],
  ['Compliance evidence', 'An enterprise evaluator needs evidence that can be passed to legal, privacy, and security reviewers.', 'Relevant compliance documentation, contractual materials, audit information, and clearly named review contacts or processes.'],
  ['Failure recovery', 'The system must avoid losing the original decision trail when a provider call fails after a memory wakes.', 'Safe retry recommendations, duplicate-action prevention, deterministic request identifiers, and recoverable error handling.'],
  ['Exit strategy', 'The team should be able to migrate away without losing its archived reasoning or coupling every memory to one provider.', 'Portable request formats, standard data representations, documented exports, and limited dependence on provider-specific state.'],
];

const riskRegister = [
  ['Unverified interface', 'The historical checkpoint could not prove a supported public integration surface.', 'Keep the candidate dormant and wake only from official API reference evidence.'],
  ['False-positive wake', 'A blog or third-party tutorial may mention documentation without proving an official supported API.', 'Require cited Nimble results from the openai.com domain family and subject-specific reference language.'],
  ['Model hallucination', 'An evidence model could cite a URL that was never returned by the search provider.', 'Reject citations not present in the exact Nimble result set.'],
  ['Duplicate action', 'Repeated watcher cycles could add the same candidate or execute the same decision twice.', 'Use database uniqueness constraints and an acted-at marker for idempotency.'],
  ['Archive corruption', 'Historical rationale could be edited or damaged while dormant.', 'Verify a SHA-256 digest before rehydrating any evidence.'],
  ['Context growth', 'Keeping every rejected provider active would make later model calls slower and more expensive.', 'Replace the detailed dossier with a compact typed spore after the archive is durable.'],
  ['Unbounded search cost', 'A scheduler could consume trial credits if it polls continuously or generates unlimited queries.', 'Use a bounded query plan, explicit intervals, due-spore selection, and one cycle for the demonstration.'],
  ['Prompt injection', 'Search snippets can contain instructions intended to influence an automated agent.', 'Treat search content as untrusted data and require structured output plus deterministic validation.'],
  ['Telemetry loss', 'A temporary analytics outage could remove the evidence that a lifecycle action occurred.', 'Write failed telemetry to a disk-backed buffer and retry delivery.'],
  ['Secret exposure', 'A browser-facing dashboard could accidentally reveal service credentials.', 'Load credentials only on the local server and publish a separate sanitized static proof site.'],
  ['Stale conclusion', 'A historical rejection can remain wrong after a provider changes its product.', 'Store an explicit wake condition and evaluate it from fresh evidence instead of relying on model memory.'],
  ['Unsupported generalization', 'A fixed demonstration could be mistaken for a universal research agent.', 'Label the current goal, source policy, historical checkpoint, and supported trigger type clearly.'],
];

const implementationPlan = [
  'Normalize the monitoring goal into a subject, bounded queries, trusted domains, and a typed condition.',
  'Store the full historical evaluation as working memory only while the lifecycle decision is being made.',
  'Validate the observation before allowing any lifecycle transition or persistence operation.',
  'Archive the complete evidence and record its checksum before deleting the working-memory row.',
  'Persist a compact spore containing the blocker, query, condition, schedule, archive pointer, and wake action.',
  'Start the watcher automatically and select every dormant spore whose next-check time has arrived.',
  'Run bounded live searches and retain titles, descriptions, URLs, and the query that produced each result.',
  'Ask Liquid for a structured evidence assessment and validate every citation against the returned source set.',
  'Apply the official-domain and subject-specific provenance guard before changing a spore to awakened.',
  'Verify archive integrity, combine historical rationale with fresh facts, and perform a guarded reevaluation.',
  'Write the shortlist decision and action marker in one database transaction so the action occurs once.',
  'Publish lifecycle events to RawTree and read the event IDs back before declaring the run verified.',
];

const historicalQuestions = evaluationDimensions.map(([category, reason, evidenceNeeded], index) => ({
  id: `Q${String(index + 1).padStart(2, '0')}`,
  category,
  question: `What official evidence would allow the team to approve ${category.toLowerCase()} for a production long-running agent?`,
  why_it_matters: reason,
  acceptance_evidence: evidenceNeeded,
  checkpoint_result: 'Not evaluated to approval because the required official Responses API reference was not available at the historical checkpoint.',
  next_action: 'Preserve this question in the archive and revisit it only after the primary documentation blocker changes.',
}));

export function buildHistoricalDossier(plan, historicalDate = '2025-02-01') {
  return {
    dossier_version: 1,
    scenario: 'Time-compressed audit of a real product transition. The checkpoint predates the public launch of the Responses API; the watcher evaluates present-day official evidence.',
    historical_checkpoint: {
      date: historicalDate,
      evidence_mode: 'historical_checkpoint',
      api_documentation_available: false,
      decision: 'Defer the candidate rather than rejecting it permanently because the blocking fact can change.',
    },
    requirements: [plan.wake_condition],
    observed_facts: { api_documentation_available: false },
    research_plan: plan,
    evaluation_brief: {
      business_goal: 'Select an API provider that a long-running technology scout can call safely, observe, and reevaluate over time.',
      decision_scope: 'The checkpoint records the full reason for deferral, the evidence still required, and the exact event that should reopen evaluation.',
      operating_principles: [
        'Prefer official documentation over summaries or third-party tutorials.',
        'Keep model interpretation useful but place lifecycle transitions behind deterministic validation.',
        'Keep remote API usage bounded, measurable, and visible to an operator.',
        'Preserve enough historical context to explain a future decision without keeping it in every model prompt.',
        'Make wake and action operations idempotent so retries cannot duplicate business effects.',
      ],
    },
    evaluation_matrix: historicalQuestions,
    risk_register: riskRegister.map(([risk, consequence, control], index) => ({ id: `R${String(index + 1).padStart(2, '0')}`, risk, consequence, control, checkpoint_status: 'Control designed; evidence review deferred with the candidate.' })),
    planned_implementation: implementationPlan.map((step, index) => ({ sequence: index + 1, step, owner: index < 4 ? 'memory lifecycle' : index < 8 ? 'autonomous watcher' : 'post-wake action and audit' })),
    decision_history: [
      { stage: 'research', conclusion: 'The provider is relevant to the integration goal and deserves a complete evaluation.' },
      { stage: 'checkpoint', conclusion: 'The evaluation cannot be approved without a current official API reference.' },
      { stage: 'memory policy', conclusion: 'The blocker is changeable, so permanent rejection would lose future value.' },
      { stage: 'sleep plan', conclusion: 'Archive the complete dossier and retain a compact availability trigger.' },
      { stage: 'wake plan', conclusion: 'Use fresh web evidence, require official citations, restore this dossier, and reevaluate once.' },
    ],
    research_notes: [
      'The detailed matrix is intentionally kept out of active context while the candidate is blocked.',
      'The compact spore must retain only the identity, blocker, wake condition, search query, schedule, archive pointer, and wake action.',
      'A present-day search result does not rewrite the historical checkpoint; it becomes separate fresh evidence used during rehydration.',
      'The final action must remain explainable from the archived dossier, accepted official citations, and validated model output.',
    ],
    source_urls: ['https://openai.com/index/new-tools-for-building-agents/'],
  };
}
