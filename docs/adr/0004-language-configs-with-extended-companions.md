# Language practices go in opt-in per-language configs, with `-extended` companions for third-party plugins

Practices from TypeScript, React and Node books go in three opt-in configs in this package (`typescript`, `react`, `node`), each with its own catalog, prefix and folder, stacking on `recommended` as `ai` does. One combined config would put React rules on non-React projects, and a config per book makes users choose books when they think in languages. Rules other plugins already have (typescript-eslint, `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-n`) are not wrapped into those configs, so they add no peer dependency; a `<name>-extended` companion bundles them behind optional peer dependencies, so turning everything on is one line without forcing installs on everyone.

## Considered options

- One `language` config for TS, JS, React and Node: rejected, React rules leak into non-React projects.
- A config per book: rejected, provenance at the cost of a usable choice.
- Wrapping third-party plugins into the plain configs: rejected, it adds required peer dependencies before anyone has approved them.
