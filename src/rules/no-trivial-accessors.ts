import { defineRule } from "../lib/define-rule.ts";
import { asTs, type FunctionNode, type TSESTree } from "../lib/ast.ts";
import {
  className,
  classOfBody,
  isPrivateField,
  memberFunction,
  memberName,
  parameterProperties,
  parameterPropertyName,
  thisMemberName,
  type ClassMember,
} from "../lib/classes.ts";

type Body = TSESTree.ClassBody;

/** The only statement of a function's block body. */
function onlyStatement(fn: FunctionNode): TSESTree.Statement | null {
  return fn.body?.type === "BlockStatement" && fn.body.body.length === 1 ? fn.body.body[0] : null;
}

/** The field a trivial getter returns: a `get` accessor, or a method with no parameters, whose body is `return this.x;`. */
function trivialGetterField(member: ClassMember): string | null {
  if (member.type !== "MethodDefinition" || (member.kind !== "get" && member.kind !== "method")) return null;
  const fn = member.value;
  if (fn.type !== "FunctionExpression" || fn.params.length > 0) return null;
  const statement = onlyStatement(fn);
  return statement?.type === "ReturnStatement" ? thisMemberName(statement.argument) : null;
}

/** Whether a member is a trivial setter: a `set` accessor, or a one-parameter method, whose body is `this.x = parameter;`. */
function isTrivialSetter(member: ClassMember): boolean {
  if (member.type !== "MethodDefinition" || (member.kind !== "set" && member.kind !== "method")) return false;
  const fn = member.value;
  const param = fn.params[0];
  if (fn.type !== "FunctionExpression" || fn.params.length !== 1 || param.type !== "Identifier") return false;
  const statement = onlyStatement(fn);
  if (statement?.type !== "ExpressionStatement" || statement.expression.type !== "AssignmentExpression") return false;
  const assignment = statement.expression;
  return assignment.operator === "=" && thisMemberName(assignment.left) !== null && assignment.right.type === "Identifier" && assignment.right.name === param.name;
}

function privateFields(body: Body): string[] {
  const names = body.body.filter(isPrivateField).map(memberName);
  for (const param of parameterProperties(body)) {
    if (param.accessibility === "private") names.push(parameterPropertyName(param));
  }
  return names.filter((name): name is string => name !== null);
}

/** The fields the class's instance members return through trivial getters, or null when it has any other method. */
function gettersOnly(body: Body): Set<string> | null {
  const returned = new Set<string>();
  for (const member of body.body) {
    if (member.type === "StaticBlock" || member.type === "TSIndexSignature" || member.static) continue;
    if (member.type === "MethodDefinition" && member.kind === "constructor") continue;
    const field = trivialGetterField(member);
    if (field) returned.add(field);
    else if (!isTrivialSetter(member) && (member.type === "MethodDefinition" || memberFunction(member))) return null;
  }
  return returned;
}

export default defineRule({
  name: "no-trivial-accessors",
  type: "suggestion",
  description: "Do not push private fields out through trivial getters: hide the implementation behind an abstraction.",
  book: {
    entry: "OBJ-03",
    chapter: "12 Objects and Data Structures § Data Abstraction",
    passage: "Hiding implementation is not just a matter of putting a layer of functions between the variables. Hiding implementation is about abstractions! A class does not simply push its variables out through getters and setters.",
  },
  messages: {
    trivialAccessors: {
      problem: "Class `{{name}}` exposes every private field ({{fields}}) through a trivial getter and has no other behaviour, so it is a data structure in disguise.",
      refactor: "either make it a plain data structure with public fields, or make it an object whose methods express an abstraction of the data (`percentFuelRemaining()` rather than `getGallonsOfGasoline()`).",
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        const body = asTs<Body>(node);
        const fields = privateFields(body);
        if (fields.length === 0) return;
        const returned = gettersOnly(body);
        if (!returned || !fields.every((field) => returned.has(field))) return;
        const owner = classOfBody(body);
        context.report({
          node: (owner.id ?? owner) as never,
          messageId: "trivialAccessors",
          data: { name: className(owner), fields: fields.map((field) => `\`${field}\``).join(", ") },
        });
      },
    };
  },
});
