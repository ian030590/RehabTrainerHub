# Agent Teams (not used here)

Claude Code Agent Teams coordinate independent Claude sessions through
`TeamCreate` and a shared task list. This Claude Code feature is not used in
this repo; `Agent`, `Task` and `TeamCreate` are blocked in the owner's
environment.

Run team members as [Codex workers](codex-workers.md). Claude supervises the
roles, handles user questions and runs specialists requested in worker reports.
For independent work, use Bash `run_in_background: true`, wait for each
completion notification, then read every result. Never run concurrent workers
that write the same files. Use sequential runs when one needs another's output.
