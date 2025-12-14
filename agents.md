# Agents

This document captures how we model and build agents inside the event-driven database and services project. It is a living spec—treat it as the single place to describe what each agent does, which events it reacts to, and how they collaborate.

## Core Principles

- **Event-first design:** Agents emit and consume immutable events. Commands mutate state only through events.
- **Single-responsibility agents:** Keep each agent focused on one capability so that failures are contained and reasoning stays simple.
- **Stateless workers:** Wherever possible, design agents to be stateless so they can be scaled horizontally.
- **Idempotency:** Every handler should be safe to run multiple times; this is mandatory when using at-least-once delivery semantics.
- **Observability:** Emit structured logs (`trace_id`, `event_id`, `agent`) and metrics for each decision made by an agent.

## Agent Catalog

| Agent | Responsibility | Consumes | Emits | Tech | Notes |
| --- | --- | --- | --- | --- | --- |
| `ingest-agent` | Pull external data sources and publish raw facts to the bus. | HTTP/WebHooks | `RawFactCaptured` | Node/TypeScript | Handles retries with exponential backoff. |
| `enrichment-agent` | Enrich raw facts with reference data. | `RawFactCaptured` | `FactEnriched` | Python | Uses Redis cache for lookup performance. |
| `persistence-agent` | Project enriched facts into the database. | `FactEnriched` | `FactStored` | Go | Writes to Postgres via outbox pattern. |
| `projection-agent` | Maintain read models optimized for queries. | `FactStored` | `ProjectionUpdated` | Rust | Optional—enable per consumer requirements. |
| `alert-agent` | Trigger alerts or workflows when thresholds are exceeded. | `ProjectionUpdated` | `AlertRaised` | TypeScript | Integrates with Slack/email/webhooks. |

> Update the table as agents are added or renamed. Remove placeholder rows when the actual implementations diverge.

## Event Contract Template

Document every event the agent uses:

```md
### Event Name
- **Purpose:** Why it exists.
- **Schema:** JSON schema or TypeScript interface.
- **Producer:** Agent or system emitting it.
- **Consumers:** Agents reacting to it.
- **Versioning:** How breaking changes are handled.
```

## Building a New Agent

1. **Define the contract** – Write the events (input/output) in this file first.
2. **Select the runtime** – Prefer languages already used in the table for operational consistency.
3. **Scaffold the service** – Follow the shared service template (logging, metrics, health checks).
4. **Implement handlers** – Ensure idempotency and add retries with jitter.
5. **Add tests** – Cover message decoding, business rules, and failure recovery.
6. **Document rollout** – Update this doc and README with deployment details.

## Testing Checklist

- Unit tests for each handler path (happy path, validation failure, external dependency failure).
- Contract tests that validate emitted events conform to schema.
- Integration tests using a local broker (e.g., Kafka + Testcontainers).
- Chaos testing plan for simulating slow/broken downstream systems.

## Operational Guidelines

- Deploy agents independently with blue/green or canary releases.
- Use infrastructure-as-code (Terraform/Pulumi) to provision topics/queues.
- Track SLOs per agent (latency, throughput, DLQ rate).
- Rotate credentials and secrets via centralized secret management.
- Keep runbooks updated with remediation steps for the on-call rotation.

## Open Questions / TODO

- Finalize broker selection (Kafka vs. NATS vs. RabbitMQ).
- Decide whether to standardize on protobuf or JSON schemas.
- Define shared libraries for telemetry and error handling.
- Document multi-tenant isolation requirements, if any.

Update this doc whenever new information surfaces so that the agent landscape stays clear to every contributor.
