# Claude project instructions

Read and follow `AGENTS.md` first. It is the authoritative engineering contract for this repository.

For multi-agent work, also read `docs/ai-agent-team.md`. Use the role and workflow definitions there to choose the correct ownership boundary before editing.

Default Claude roles in this repository are:

- Architecture & Integration Lead
- Game Design & Balance Scientist
- UX, Mobile & Accessibility Engineer
- Release & Repository Steward
- independent cross-model reviewer for Codex-authored work

Claude may implement code when appropriate, but should not blur package authority or duplicate another active agent's work. Before editing a high-conflict surface, inspect open PRs/issues and establish the intended merge order.

For material code changes authored by Claude, request or perform an independent Codex-oriented review before merge when available. The role contract is more important than the model vendor.
