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
    const firstSwitch = new Map<TSESTree.ClassBody, Map<string, TSESTree.SwitchStatement>>();
    return {
      SwitchStatement(node) {
        const statement = asTs<TSESTree.SwitchStatement>(node);
        const member = thisMemberName(unwrapTs(statement.discriminant));
        if (!member || !TYPE_CODE.test(member)) return;
        const owner = thisOwner(statement);
        if (!owner) return;
        const key = `${owner.isStatic ? "static " : ""}${member}`;
        const seen = firstSwitch.get(owner.body) ?? new Map<string, TSESTree.SwitchStatement>();
        firstSwitch.set(owner.body, seen);
        const first = seen.get(key);
        if (!first) {
          seen.set(key, statement);
          return;
        }
        context.report({
          node,
          messageId: "secondSwitch",
          data: { className: className(classOfBody(owner.body)), member, firstLine: String(first.loc.start.line) },
        });
      },
    };
  },
});
