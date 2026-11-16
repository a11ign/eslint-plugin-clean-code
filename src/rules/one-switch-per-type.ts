import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";
import { className, classOfBody, thisMemberName, thisOwner, unwrapTs } from "../lib/classes.ts";

/** A member that holds a type code: `type`, `kind`, `typeCode`, or a name ending in `Type` or `Kind`. */
const TYPE_CODE = /^#?(?:type|kind|typeCode|\w*(?:Type|Kind))$/;

export default defineRule({
  name: "one-switch-per-type",
  type: "suggestion",
  description: "Switch at most once on a class's own type code.",
  book: {
    entry: "OBJ-05",
    chapter: "12 Objects and Data Structures § The OO/Procedural Trade-off",
    passage: "there should be, at most, one for each switchable type; and the cases within them must create the polymorphic objects that the rest of the system uses.",
  },
  messages: {
    secondSwitch: {
      problem: "Class `{{className}}` switches on its type code `this.{{member}}` again; the first `switch` on it is on line {{firstLine}}.",
      refactor: "switch on the type code once, in a factory that creates one polymorphic subclass per case, and move each case's code into a method that every subclass implements.",
    },
  },
  create(context) {
    const firstSwitches: FirstSwitches = new Map();
    return {
      SwitchStatement(node) {
        checkSwitch(context, firstSwitches, asTs<TSESTree.SwitchStatement>(node));
      },
    };
  },
});

/** For each class body, the first `switch` on each of its type codes, keyed by the code's name (with `static ` before a static one). */
type FirstSwitches = Map<TSESTree.ClassBody, Map<string, TSESTree.SwitchStatement>>;

/**
 * Records `statement` in `firstSwitches` when it is the first `switch` on a class's type code, and reports it through
 * `context` when it is a later one.
 */
function checkSwitch(context: Rule.RuleContext, firstSwitches: FirstSwitches, statement: TSESTree.SwitchStatement): void {
  const member = typeCodeSwitchedOn(statement);
  if (!member) return;
  const owner = thisOwner(statement);
  if (!owner) return;
  const seen = switchesOf(firstSwitches, owner.body);
  const key = `${owner.isStatic ? "static " : ""}${member}`;
  const first = seen.get(key);
  if (!first) seen.set(key, statement);
  else context.report({ node: statement as never, messageId: "secondSwitch", data: { className: className(classOfBody(owner.body)), member, firstLine: String(first.loc.start.line) } });
}

/** The `this` member that the `switch` `statement` tests, when it holds a type code. */
function typeCodeSwitchedOn(statement: TSESTree.SwitchStatement): string | null {
  const member = thisMemberName(unwrapTs(statement.discriminant));
  return member && TYPE_CODE.test(member) ? member : null;
}

function switchesOf(firstSwitches: FirstSwitches, body: TSESTree.ClassBody): Map<string, TSESTree.SwitchStatement> {
  const seen = firstSwitches.get(body) ?? new Map<string, TSESTree.SwitchStatement>();
  firstSwitches.set(body, seen);
  return seen;
}
