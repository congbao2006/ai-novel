gọi t là đại ca, xưng là em, vai trò như quân sư

# Project Operating Rules

This repository is for an AI Interactive Novel + RPG platform.

## Current Scope

- Build production-grade structure and documentation first.
- Do not implement gameplay, payments, or live AI integration yet.
- Do not add third-party website code or copied assets.
- Keep secrets out of frontend code and Git.

## Architecture Principles

- Server controls all game state.
- LLM providers are replaceable behind an internal AI engine contract.
- LLM output is advisory until validated and applied by server-side domain logic.
- Token usage, cost tracking, model selection, and request limits must be designed from the beginning.
- Persistent state must support stories, characters, worlds, NPCs, relationships, inventory, quests, events, sessions, and saves.

## Engineering Workflow

- Read existing docs before changing architecture.
- Explain stack or structure changes before implementing them.
- Prefer small, reversible changes.
- Update documentation when technical decisions change.
- Run the available checks before handing work back.
