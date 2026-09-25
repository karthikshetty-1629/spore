# SPORE

**Forget intelligently. Remember at the right moment.**

Semantic Persistence & On-demand Rehydration Engine.

SPORE is a hackathon project exploring conditional memory for long-running agents. An observation that is irrelevant now can leave working context while retaining a compact wake condition, historical rationale, and a recipe for reconstructing relevant context later.

## Current status

The repository is a finalized development baseline. The local build observatory runs, live connection checks have verified Nimble search and RawTree event write/read access, and three Liquid models are available locally through Ollama.

The first memory-gate evaluation showed that an LLM cannot safely own lifecycle decisions by itself: the 1.2B instruct model passed 1/8 strict cases, the 2.6B reasoning model did not produce usable short structured responses, and the 8B-A1B model understood the SPORE case but still omitted a required trigger field. The implementation will therefore combine Liquid-assisted extraction with a deterministic policy, schema validation, and fail-closed behavior.

The project now implements the complete local memory lifecycle: validated classification, SQLite persistence, integrity-checked archive-and-forget, scheduled Nimble condition checks, idempotent waking, context rehydration, provider reevaluation, a persistent shortlist action, and RawTree lifecycle telemetry with disk-backed retry. A guided one-screen demo console runs every stage against a persistent SQLite database, labels replay versus live evidence, shows sponsor-tool progress, and exposes the equivalent command and verification links. Demo rehearsal, recording, and submission remain. See [the continuation handoff](docs/HANDOFF.md) for acceptance criteria.

## Intended demonstration

1. A technology scout researches providers against an integration goal.
2. The memory gate classifies observations as ACTIVE, DURABLE, SPORE, or DISCARD.
3. A provider blocked by a missing public API becomes a dormant SPORE; its detailed evidence leaves active context and is archived.
4. A scheduled watcher uses fresh web evidence to evaluate the stored wake condition.
5. When the condition is satisfied, the agent combines archived rationale with fresh evidence, reevaluates the provider, and updates its candidate list.

The demo must distinguish real observations from fixtures or historical replay. A manual wake button does not establish autonomous detection. All context savings and usefulness metrics must be measured, not hard-coded as results.

## Proposed integrations

| Service | Role | Status |
| --- | --- | --- |
| Liquid AI | Structured extraction and post-wake reevaluation | Three local models installed; gate requires deterministic validation |
| Nimble | Live web research and condition checks | Connection verified |
| Tinybird / RawTree | Memory lifecycle events and analytics | Write/read verified |
| AWS | Agent inference and persistent storage | Optional; local substitutes selected |

The initial goal is one complete loop with a narrow trigger type. Infrastructure choices will follow verified sponsor access.

## Setup

See [the setup checklist](docs/SETUP.md). Copy `.env.example` to `.env` for local settings. `.env` and runtime data are excluded from Git.

Verify the local development environment without spending remote API credits:

```sh
npm run doctor
npm run check
```

Inspect the four-state memory gate on the representative scenarios:

```sh
npm run gate:demo
```

Inspect the local SQLite memory records without creating a persistent file:

```sh
npm run storage:demo
```

Inspect the archive-and-forget lifecycle using temporary local storage:

```sh
npm run lifecycle:demo
```

Run the watcher with explicitly labeled historical-replay evidence and no API credits:

```sh
npm run watcher:demo
```

Run the complete archive, wake, rehydrate, reevaluate, and shortlist flow with replay evidence:

```sh
npm run action:demo
```

Measure that full replay lifecycle locally without spending credits:

```sh
npm run telemetry:demo
```

Send one labeled test batch to RawTree and verify it by reading the event IDs back:

```sh
npm run telemetry:live
```

Run the local build observatory:

```sh
npm run dev
```

Then open `http://127.0.0.1:4317`. The page reports recorded milestones and checks live Ollama health; it does not expose credentials.

The guided demo is the first section on that page. Click **Reset demonstration**, then run its seven numbered buttons in order. It persists inspectable state in `data/spore-demo.sqlite` and detailed evidence in `data/spore-demo-archives/`. The same stages can be run from a terminal:

```sh
npm run demo -- reset
npm run demo -- observe
npm run demo -- classify
npm run demo -- sleep
npm run demo -- wake-live
npm run demo -- rehydrate
npm run demo -- act
npm run demo -- telemetry
```

`wake-live` uses one Nimble search. `wake-replay` is the labeled, repeatable alternative. The final telemetry stage sends one labeled batch to RawTree and verifies it by read-back.

## Event

[Long Horizon Agents Hack](https://tokensand.com/horizonagentshack), September 25, 2026.

The event page lists a 4:30 PM Pacific submission deadline and requests a public repository, shareable demo video, project/tool description, and team contact details. Confirm organizer announcements for changes.
