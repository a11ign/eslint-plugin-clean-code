/**
 * The plugin without its configs: the rules and the plugin's name. Oxlint loads this entry through `jsPlugins`, and it imports
 * nothing but the rules, so an Oxlint project needs neither ESLint nor typescript-eslint installed.
 */
import { rules } from "./rules/index.ts";
import { PACKAGE_NAME } from "./lib/define-rule.ts";

const plugin = {
  meta: { name: PACKAGE_NAME },
  rules,
};

export default plugin;
