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
- A labeled test event was written to and read from RawTree table `spore_karthik_memory_events`.
- Ollama has the Liquid 1.2B Instruct, 2.6B, and 8B-A1B GGUF models installed.
- `.env`, runtime data, archives, databases, model weights, and logs are excluded from Git.
- The deterministic four-state memory policy is implemented in `src/memory/policy.mjs` and passes the eight representative fixtures.
- Strict boundary validation, persistence, and the rest of the application-core agent loop are not implemented yet.

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

Current position: the deterministic four-state policy and representative regression fixtures are complete. Strict schema validation is next.

1. Add versioned schemas and strict validation around the completed deterministic policy.
2. Add SQLite tables for spores, working memory, durable memory, and runs.
3. Add local archive storage and prove that spored evidence leaves working context.
4. Wrap the proven Nimble search request in a narrow adapter returning normalized evidence with URLs and timestamps.
5. Wrap RawTree writes in an append-only lifecycle event adapter.
6. Add a scheduler, due-spore query, and typed condition evaluator.
7. Rehydrate archived rationale with fresh evidence, reevaluate the provider, and update a shortlist.
8. Add a resettable end-to-end scenario using clearly labeled Day 1 / Day 60 fixtures.
9. Replace or supplement the replay sensor with live Nimble evidence.
10. Feed actual lifecycle data and measured context reduction into the existing dashboard.
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

> Read `README.md`, `docs/SETUP.md`, and `docs/HANDOFF.md`, inspect Git status and recent commits, run `npm run doctor` and `npm run check`, and then implement the first vertical slice from schemas through SQLite persistence. Do not expose `.env` values or redesign the dashboard.
