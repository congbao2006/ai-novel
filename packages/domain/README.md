# Domain Package

Future deterministic gameplay and state-transition rules.

Responsibilities:

- Validate player actions.
- Validate AI-proposed state changes.
- Apply allowed events.
- Keep world, NPC, relationship, inventory, quest, and session state coherent.

This package should remain independent from databases, frontend frameworks, and LLM provider SDKs.
