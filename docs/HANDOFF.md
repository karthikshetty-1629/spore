# SPORE continuation handoff

This file is the repository-level continuation guide for a coding agent. It records the implemented state separately from the target architecture so future work does not overclaim progress.

## Mission

Build one complete, auditable conditional-memory loop for a technology scout:

```text
Nimble research
  -> structured observation
  -> Liquid-assisted extraction
  -> deterministic ACTIVE / DURABLE / SPORE / DISCARD policy
  -> persistence and working-state rewrite
  -> scheduled wake check
  -> typed condition evaluation
  -> rehydration with fresh evidence
  -> provider reevaluation and next action
  -> RawTree lifecycle telemetry
  -> dashboard
```

The required demonstration is: the agent forgets something, the world changes, the agent independently detects the change, the memory wakes, and the agent acts.

## Verified baseline

- The repository is public at <https://github.com/karthikshetty-1629/spore>.
- `npm run dev` serves the local build observatory at <http://127.0.0.1:4317>.
- A live Nimble search returned source URLs.
- A connection event was verified in `spore_karthik_memory_events`; a complete 11-event lifecycle replay was written to and read from `spore_karthik_lifecycle_events_v1`.
- Ollama has the Liquid 1.2B Instruct, 2.6B, and 8B-A1B GGUF models installed.
- `.env`, runtime data, archives, databases, model weights, and logs are excluded from Git.
- The deterministic four-state memory policy is implemented in `src/memory/policy.mjs` and passes the eight representative fixtures.
- Strict input/output validation is implemented in `src/domain/memory-validation.mjs`; `src/memory/gate.mjs` is the validated entry point.
- SQLite persistence for runs, working memory, durable memory, and spores is implemented in `src/storage/sqlite.mjs`; the default application path is `data/spore.sqlite`.
- Integrity-checked evidence archiving and transactional working-context removal are implemented in `src/storage/archive.mjs` and `src/memory/lifecycle.mjs`.
- The bounded Nimble adapter, typed condition evaluator, and autonomous idempotent watcher are implemented under `src/integrations` and `src/watcher`.
- Archived context rehydration, strict Liquid reevaluation support, deterministic reevaluation, idempotent action logging, and persistent shortlist updates are implemented under `src/agent`.
- Stable RawTree lifecycle events, batched delivery, disk-backed retry, read-back verification, measured metrics, and dashboard rendering are implemented under `src/telemetry`, `src/integrations/rawtree.mjs`, and `scripts/demo-telemetry.mjs`.
- The complete verified telemetry run is explicitly labeled `historical_replay` and `is_test`. Live-evidence demo rehearsal, recording, and submission remain.

## Model evidence

The eight-case smoke test is a small project regression set, not a general benchmark.

| Model | Observed result | Decision |
| --- | --- | --- |
| LFM2.5-1.2B-Instruct | 1/8 strict cases passed; approximately 0.7-1.6 seconds per call | May assist fact extraction, but cannot own the gate |
| LFM2.5-2.6B | 0/8 parsed; short requests exhausted output in reasoning | Do not use for the live gate |
| LFM2.5-8B-A1B | Understood the SPORE case, but returned invalid or incomplete structure depending on schema | Use for deeper reevaluation behind validation |

The gate must use versioned schemas, deterministic policy, validation invariants, at most one bounded repair attempt, and fail-closed behavior.

## Memory invariants

- `decision` must be exactly `ACTIVE`, `DURABLE`, `SPORE`, or `DISCARD`.
- `SPORE` requires a typed `wake_condition`; all other states require `wake_condition: null`.
- The first supported operators are `==` and `<=`.
- Availability and compliance targets are booleans; thresholds are numbers.
- A standing user rule is `DURABLE`. A completed candidate evaluation blocked by a changeable fact is `SPORE`.
- An unfinished task is `ACTIVE`.
- Every spore needs source provenance, a monitoring query, an archive pointer, a schedule, and an on-wake action.
- Waking and acting must be idempotent.

## Exact build order

Current position: the complete replay lifecycle through RawTree telemetry and dashboard metrics is implemented and verified. Demo rehearsal and a live-evidence pass are next.

1. Completed: versioned decision shape, deterministic policy, strict validation, and regression tests.
2. Completed: SQLite tables for spores, working memory, durable memory, and runs.
3. Completed: local archive storage with integrity checks and transactional working-context removal.
4. Completed: bounded Nimble search adapter returning normalized evidence with URLs.
5. Completed: RawTree append-only lifecycle event adapter, batch delivery, buffering, and read-back verification.
6. Completed: scheduler, due-spore query, typed condition evaluator, retry isolation, and idempotent waking.
7. Completed: rehydrate archived rationale with fresh evidence, reevaluate the provider, and update a shortlist exactly once.
8. Completed: resettable end-to-end scenario using clearly labeled historical replay evidence.
9. Replace or supplement the replay sensor with live Nimble evidence.
10. Completed: feed actual lifecycle data and measured context reduction into the existing dashboard.
11. Rehearse twice, record a three-minute demo, and submit.

## Initial regression cases

| Observation | Expected state |
| --- | --- |
| Provider rejected only for a missing public API | SPORE |
| Provider costs $140 under a continuing $100 cap | SPORE |
| All adopted vendors must support AWS | DURABLE |
| The continuing maximum budget is $100 | DURABLE |
| Eligible provider is in today's shortlist | ACTIVE |
| Current comparison still has unanswered questions | ACTIVE |
| Repeated cookie banner | DISCARD |
| Unrelated logo color | DISCARD |

## Constraints

- Never print or commit credential values. Keep credentials out of browser JavaScript.
- The Nimble key was pasted into a chat during setup; rotate it when practical.
- Distinguish live, cached, fixture, and replay evidence in storage and UI.
- A manual wake button is not proof of autonomy.
- Measure tokens or bytes from real serialized payloads. Do not hard-code savings.
- Keep AWS optional unless real credits and access become available.
- Use Liquid AI, Nimble, and RawTree in the working path.
- Freeze cosmetic dashboard work until the vertical lifecycle passes.

## First definition of done

A test and demo run show that a missing-API observation becomes a persisted dormant spore, leaves working context, remains dormant on unchanged evidence, wakes exactly once on changed evidence, reloads its historical rationale, and causes the scout to update its shortlist. RawTree must contain enough events to reconstruct the sequence.

## Start a continuation session

Tell the coding agent:

> Read `README.md`, `docs/SETUP.md`, and `docs/HANDOFF.md`, inspect Git status and recent commits, run `npm run doctor` and `npm run check`, then run `npm run telemetry:demo`. Continue with the live-evidence demo pass, rehearsal, recording, and submission. Do not expose `.env` values or overstate replay evidence as live.
