# SPORE setup checklist

This checklist separates account setup from implementation. Nimble and RawTree access have been verified; Liquid model quality is being evaluated locally.

## 1. Event access

- Sign in to the [event page](https://tokensand.com/horizonagentshack).
- Join the [Discord linked by the organizer](https://bit.ly/discord-17).
- Check announcements for sponsor credits, requirements, and deadline changes.
- Open the [submission form](https://tokensand.com/horizonagentshack/submit) early to check required fields. Do not submit until the project is ready.

## 2. Nimble: first priority

- Sign in or create an account using the sponsor's event onboarding if provided.
- Obtain application API access from [API key settings](https://online.nimbleway.com/settings/api-keys).
- Put the key in local `.env` as `NIMBLE_API_KEY`.
- Ask the sponsor to apply any event credits. Credits are not confirmed by this repository.
- Reference: [Nimble documentation](https://docs.nimbleway.com/home).

Completion check for implementation: one successful live search request with source URLs.

## 3. Tinybird / RawTree

- Start with the [event-specific RawTree link](https://rawtree.com/tokensand), not an assumed legacy Tinybird setup.
- Create or select a database for SPORE and note its name.
- Create a `read_write` API key for inserting events and querying metrics.
- Fill `RAWTREE_API_KEY` and `RAWTREE_DATABASE` in local `.env`.
- References: [API quickstart](https://rawtree.com/docs/quickstart/api), [authentication](https://rawtree.com/docs/reference/authentication).

Completion check for implementation: insert a test lifecycle event and read it back.

## 4. Liquid AI

Ask the sponsor whether an event-hosted inference endpoint is available. Record its model ID and setup instructions if so.

The documented local runtime is Ollama. Install and open [Ollama for macOS](https://ollama.com/download), then download the instruct model used in Liquid's official guide:

```sh
ollama pull hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF
```

This is the fast baseline. Larger Liquid models can also run through Ollama, but each candidate must be tested for schema compliance, latency, and decision quality before selection. The local option does not require paid inference credits.

References: [model library](https://docs.liquid.ai/lfm/models/complete-library), [official Ollama guide](https://docs.liquid.ai/deployment/on-device/ollama).

Completion check for implementation: obtain and validate one memory classification with a structured wake condition.

## 5. AWS

- Ask the AWS representative whether an event account, credits, or a prepared environment is available.
- Confirm the recommended region and access to a Bedrock model for the scout.
- Confirm how to authenticate locally with the provided account/profile.
- Record the region, profile name, and model ID; use the normal AWS credential provider flow.
- Create DynamoDB/S3 resources only when the implementation needs them.

AgentCore is optional for the hackathon build. The local plan uses SQLite for the spore registry, a local archive directory, and an application worker for scheduled checks so the three confirmed sponsor integrations remain the critical path.

## Submission checklist

- Public GitHub repository.
- Shareable short demo video.
- Honest description of implemented behavior and sponsor tools actually used.
- Solo participant name and contact email entered in the submission form.
- Optional website and screenshot.

The posted deadline is September 25, 2026, 4:30 PM Pacific. The supplied judging slide calls for a three-minute presentation and effective use of at least three sponsor tools.
