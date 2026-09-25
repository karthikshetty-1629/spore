# SPORE

**Forget intelligently. Remember at the right moment.**

Semantic Persistence & On-demand Rehydration Engine.

SPORE is a hackathon project exploring conditional memory for long-running agents. An observation that is irrelevant now can leave working context while retaining a compact wake condition, historical rationale, and a recipe for reconstructing relevant context later.

## Current status

The repository is a finalized development baseline. The local build observatory runs, live connection checks have verified Nimble search and RawTree event write/read access, and three Liquid models are available locally through Ollama.

The first memory-gate evaluation showed that an LLM cannot safely own lifecycle decisions by itself: the 1.2B instruct model passed 1/8 strict cases, the 2.6B reasoning model did not produce usable short structured responses, and the 8B-A1B model understood the SPORE case but still omitted a required trigger field. The implementation will therefore combine Liquid-assisted extraction with a deterministic policy, schema validation, and fail-closed behavior.

The project now implements the complete autonomous memory lifecycle: Liquid plans a bounded research task, Nimble executes multiple live searches, a guarded Liquid evidence assessment cites official sources, the deterministic gate creates a dormant SPORE, and `AutonomousWatcher.start()` runs the due check without a wake button. The agent then rehydrates its archived rationale, makes a guarded Liquid decision, updates its persistent shortlist, and sends the lifecycle to RawTree for read-back verification.

The local dashboard starts that entire flow from one goal. A separate explain mode still exposes individual components. A read-only public proof site is generated from the latest verified run so visitors cannot access credentials or spend trial credits.

## Intended demonstration

1. The user gives the scout one monitoring goal.
2. Liquid creates a structured plan with multiple searches, official domains, and a typed wake condition.
3. The memory gate turns a dated historical checkpoint into a dormant SPORE and removes its detailed payload from working context.
4. The scheduler starts itself; Nimble researches the live web and Liquid assesses the results behind an official-source guard.
5. When the condition is satisfied, the agent restores archived rationale, reevaluates the provider with Liquid, updates its shortlist exactly once, and verifies its RawTree audit trail.

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

Then open `http://127.0.0.1:4317`. The page reports recorded milestones and checks live Ollama health; it does not expose credentials. Click **Start autonomous agent** once. The remaining phases run without stage buttons. The verified scenario uses one fixed Responses API goal. Starting it again clears the previous autonomous database and archive, then repeats the complete pipeline with three live Nimble searches and one RawTree event batch.

The optional explain mode exposes the older seven-stage flow for component inspection. It persists inspectable state in `data/spore-demo.sqlite` and detailed evidence in `data/spore-demo-archives/`. The same stages can be run from a terminal:

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

Generate the read-only GitHub Pages proof from the latest successful run:

```sh
npm run site:build
```

The generated `docs/` site contains sanitized run evidence and no credentials or writable API routes.

## Event

[Long Horizon Agents Hack](https://tokensand.com/horizonagentshack), September 25, 2026.

The event page lists a 4:30 PM Pacific submission deadline and requests a public repository, shareable demo video, project/tool description, and team contact details. Confirm organizer announcements for changes.
