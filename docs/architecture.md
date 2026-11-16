# Architecture

Status: **provisional** — the integration strategy (Web Services API vs. Playwright) is decided at
the end of Phase 0 (`docs/moodle-investigation.md`). Target design: `docs/requirements.md` §9–§10.

## Layers (dependencies point down only)

```text
mcp/             MCP server, tool registry, Zod input schemas, response serialization
application/     use cases (list courses, deadlines, summary...), confirmation rules for writes
domain/          entities, MoodleAdapter interface, error types (requirements §12)
infrastructure/  MoodleAdapter implementations (api/ first, browser/ fallback), auth/session, logging
```

Rule: `mcp/` and `application/` never import from `infrastructure/` directly; the adapter is
injected at startup in `src/index.ts`.

## Decisions

See `docs/decisions/`.
