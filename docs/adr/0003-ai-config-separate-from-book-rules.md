# AI anti-pattern rules go in a separate opt-in `ai` config, not in the book's `recommended`

`eslint-plugin-clean-code-book` is "rules from *Clean Code, 2nd Edition*", and `docs/catalog.md` requires a book passage for each rule. Rules against the habits of AI-generated code, such as narrating comments or a reflexive log-and-rethrow `catch`, have no such passage, and some of them contradict a book example. We add them to the same package as a standalone `ai` config, with their own `docs/catalog-ai.md`. Each entry there is justified by the AI pattern and its harm, and carries a Language basis line. `recommended` stays unchanged.

## Considered options

- **A second package** (`eslint-plugin-clean-code-ai`): a clean split, but a second release pipeline and a second install for the same audience.
- **Into `recommended`:** one config, but it breaks the package's premise, and every book user would get opinionated rules without having chosen them.

## Consequences

The rule IDs `clean-code-book/ai-*` become public names once released, so renaming or moving them later is a breaking change. A project running both `recommended` and `ai` can be reported for following the book's Java `delete()` example. The rule's "Where this departs from the book" section explains why.
