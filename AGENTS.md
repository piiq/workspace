# Agent instructions

- Inspect the branch, PR target and working tree before editing. Preserve unrelated changes. you are not alone in the worktree.
- Do not commit, push, create or update a PR, or deploy without an explicit request.
- Keep the diff tied to the request. Do not mix feature work with formatting, dependency upgrades or cleanup.
- Use the existing toolchain and local conventions. Report conflicting or unavailable tooling instead of substituting another stack.
- Every new abstraction must be justified by reuse in the current change or logic already present in the application. Do not add wrappers, helpers, services, configuration layers or extension points for hypothetical future work.
- Do not speculate about hypothetical edge cases or unlikely failure modes. Do not invent safeguards for speculative/nonexistent risks.
- Use plain, specific language in comments, documentation, commits and merge requests. A technical term belongs when it names an established product concept, protocol, library or code construct more precisely than ordinary language.
- Do not replace facts with metaphorical or model-favored jargon such as `load-bearing`, `seam`, `footgun`, `guardrail`, `plumbing`, `scaffolding`, `contraxt`, `blast radius`, `shape of`, `land` or `leverage`. Name the affected code, behavior, dependency or failure. Use such a term only for its literal, established meaning in the project.
- Avoid stock AI rhetoric: contrasts such as "not X, but Y", canned setup such as "worth noting", empty modifiers such as "quietly" or "genuinely", vague claims such as "robust" or "comprehensive", fake quotations and labels such as "minimal path" that do not describe behavior.
- Describe behavior and constraints, not development progress. Keep branch status, session notes and follow-up promises in issue or PR discussions.
- Comments explain non-obvious behavior, compatibility constraints or decisions. Do not restate the code or add issue references and work logs to source files.
- Update documentation made inaccurate by the change. Do not create plans, reports or documentation bundles by default.
- Use descriptive branches such as `fix/<problem>`, `feat/<capability>` and `docs/<topic>`. Base them on the intended PR target.
- Keep commits and PRs focused. Use imperative commit subjects. PR titles name the change; descriptions state durable behavior and necessary constraints. Routine check results and temporary stack dependencies belong in discussions or CI.
- Do not add `Co-authored-by`, generated-by or other AI attribution to commit messages or PR text.
- Report checks actually run and behavior left unverified. A skipped or unavailable check is not a pass.
