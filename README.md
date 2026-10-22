# OpenHamShack family

> **Renamed 09/10/2026 (product names) and 21/10/2026 (everything else)**: product names below have used OpenHamShack since 09/10; code paths, repos and packages caught up on 21/10, when the family's git history was rewritten end to end (see GUIDE.md §5 for what that changed and left behind).

The place that ties the OpenHamShack projects together: the platform plan, the
development guide every OpenHamShack session should follow, and handovers between
sessions. Code lives in each product's own repo; this repo holds what spans
them.

- [docs/GUIDE.md](docs/GUIDE.md): read first. It covers the family map
  (every product in every form), the shared contract, the change checklist,
  test rigs, known traps and release ownership.
- [docs/PLATFORM-PLAN.md](docs/PLATFORM-PLAN.md): OpenHamShack as a customised
  Dock360 with an OpenHamShack app per product, the hardware broker, phases and
  open decisions.
- [HANDOVER.md](HANDOVER.md): where things stand right now and what's next.

The Claude Code skill `openhamshack` (in `~/.claude/skills/`) points
sessions here automatically.
