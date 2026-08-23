# UI Feature Map

This map keeps implemented backend capabilities discoverable from the web UI.

| Feature | Route | Frontend page | API endpoint | Status |
| --- | --- | --- | --- | --- |
| Auth status/logout | Global shell | `components/auth-status.tsx` | `GET /auth/me`, `POST /auth/logout` | Active |
| Home dashboard | `/` | `app/page.tsx` | `GET /sessions`, `GET /stories`, `GET /author/stories` | Active |
| Browse stories | `/stories` | `app/stories/page.tsx` | `GET /stories`, `GET /sessions` | Active |
| Story detail | `/stories/:slug` | `app/stories/[slug]/page.tsx` | `GET /stories/:slug` | Active |
| Continue existing run | `/stories`, `/stories/:slug`, `/sessions` | Story cards and session cards | `GET /sessions`, `GET /sessions/:id` | Active |
| Start new run | `/stories/:slug` | `StartSessionForm` | `POST /sessions` | Active |
| My Sessions | `/sessions` | `app/sessions/page.tsx` | `GET /sessions`, `GET /sessions/:id` | Active |
| Gameplay | `/play/:sessionId` | `app/play/[sessionId]/page.tsx` | `GET /sessions/:id`, `POST /sessions/:id/turns` | Active |
| Gameplay runtime panels | `/play/:sessionId` | World/quest/inventory/ability panels | `GET /sessions/:id/factions`, `/quests`, `/inventory` | Active |
| Creator Studio | `/author` | `app/author/page.tsx` | `GET /author/stories` | Active |
| Create draft | `/author/stories/new` | `app/author/stories/new/page.tsx` | `POST /author/stories` | Active |
| Story editor overview/world | `/author/stories/:id` | Overview and World sections | `GET/PATCH /author/stories/:id` | Active |
| Character templates | `/author/stories/:id#characters` | Character manager | `POST /author/stories/:id/characters` | Active |
| Ability definitions | `/author/stories/:id#abilities` | Ability manager | `POST/DELETE /author/stories/:id/abilities` | Active |
| Ability assignment | `/author/stories/:id#abilities` | Ability manager | `POST/DELETE /author/stories/:id/characters/:characterId/abilities` | Active |
| Faction templates | `/author/stories/:id#factions` | Faction manager | `POST /author/stories/:id/factions` | Active |
| Version lifecycle | `/author/stories/:id#versions` | Versions section | `POST /author/stories/:id/revisions`, `/publish`, `/archive` | Active |
| Publish validation | `/author/stories/:id#publish` | Publish section | `POST /author/stories/:id/validate` | Active |
| Read | Global nav/story detail | Coming-soon state | None yet | Planned |
| Listen | Global nav/story detail | Coming-soon state | None yet | Planned |
| Community | Global nav/story detail | Coming-soon state | None yet | Planned |
