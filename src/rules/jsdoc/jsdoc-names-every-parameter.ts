import type { Rule, SourceCode } from "eslint";
import { defineJsdocRule } from "../../lib/define-rule.ts";
import { asTs, type Comment, type Node, type TSESTree } from "../../lib/ast.ts";
import { isDocComment } from "../../lib/safe-fix.ts";

/** A function or a signature whose parameters its doc comment names. */
type Signature =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSDeclareFunction
  | TSESTree.TSEmptyBodyFunctionExpression
  | TSESTree.TSMethodSignature;

const SIGNATURES = ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "TSDeclareFunction", "TSEmptyBodyFunctionExpression", "TSMethodSignature"];

/** The members whose doc comment is their function value's: a method, an object property or a class field. */
const MEMBERS = new Set(["MethodDefinition", "TSAbstractMethodDefinition", "Property", "PropertyDefinition", "TSAbstractPropertyDefinition"]);

const EXPORTS = new Set(["ExportNamedDeclaration", "ExportDefaultDeclaration"]);

/** A name a parameter binds, and the identifier that binds it. */
interface Binding {
  name: string;
  node: Node;
}

/** One parameter: the names it binds, and whether it is destructured, so an `@param` of any name can document it whole. */
interface Parameter {
  bindings: Binding[];
  destructured: boolean;
}

/** What a doc comment names: the text of its Markdown code spans, and the parameter names of its `@param` tags that have a description. */
interface DocNames {
  spans: Set<string>;
  tags: string[];
}

/**
 * The bindings of `signature`'s parameters that the doc comment directly before it, read from `sourceCode`, names neither in a
 * code span nor by an `@param` tag.
 */
function unnamedBindings(sourceCode: SourceCode, signature: Signature): Binding[] {
  const comment = docCommentOf(sourceCode, documentedNode(signature));
  return comment ? unnamedIn(signature.params.map(parameterOf), docNames(comment)) : [];
}

/**
 * The bindings of `parameters` that `doc` does not name. A name starting with `_` is exempt. A destructured parameter is named
 * whole by an `@param` whose name no parameter binds, taken in order: one such tag for each destructured parameter.
 */
function unnamedIn(parameters: Parameter[], doc: DocNames): Binding[] {
  const isNamed = (binding: Binding) => binding.name.startsWith("_") || doc.spans.has(binding.name) || doc.tags.includes(binding.name);
  const bound = new Set(parameters.flatMap((parameter) => parameter.bindings.map((binding) => binding.name)));
  let wholeTags = doc.tags.filter((tag) => !bound.has(tag)).length;
  return parameters.flatMap((parameter) => {
    const unnamed = parameter.bindings.filter((binding) => !isNamed(binding));
    if (unnamed.length === 0 || !parameter.destructured || wholeTags === 0) return unnamed;
    wholeTags -= 1;
    return [];
  });
}

/** The doc comment `sourceCode` has directly before `node`, with nothing but blank space between; `null` when there is none. */
function docCommentOf(sourceCode: SourceCode, node: Node): Comment | null {
  const comment = sourceCode.getCommentsBefore(node as never).at(-1);
  return comment && isDocComment(comment) ? comment : null;
}

/**
 * The node whose doc comment is `signature`'s: a method's or property's member, the `const` that holds an arrow function, the
 * `export` that declares it, the statement that assigns it, or else `signature` itself.
 */
function documentedNode(signature: Signature): Node {
  const parent = signature.parent;
  if (parent && MEMBERS.has(parent.type)) return parent;
  if (parent?.type === "VariableDeclarator") return declarationOf(parent, signature);
  if (parent?.type === "AssignmentExpression" && parent.parent.type === "ExpressionStatement") return parent.parent;
  return withExport(signature);
}

/** The declaration of `declarator`, with its `export`, when it is the first declarator: its doc comment is then `signature`'s. */
function declarationOf(declarator: TSESTree.VariableDeclarator, signature: Signature): Node {
  const declaration = declarator.parent;
  return declaration.declarations[0] === declarator ? withExport(declaration) : signature;
}

/** The `export` that declares `node`, or `node` itself. */
function withExport(node: Node): Node {
  return node.parent && EXPORTS.has(node.parent.type) ? node.parent : node;
}

/** The names `comment` gives: its code spans' text, and the root name of each `@param` that has a description. */
function docNames(comment: Comment): DocNames {
  const text = comment.value.split(/\r?\n/).map((line) => line.replace(/^\s*\*+ ?/, "")).join("\n");
  const spans = [...text.matchAll(/(`+)([\s\S]*?[^`])\1(?!`)/g)].map((match) => match[2].trim().replace(/^\.\.\./, ""));
  const tags = text.split(/^(?=[ \t]*@)/m).flatMap(describedParamName);
  return { spans: new Set(spans), tags };
}

/** The root name the `@param` tag in `block` documents (`options` for `@param options.root`), when it has a description; else none. */
function describedParamName(block: string): string[] {
  const tag = /^\s*@(?:param|arg|argument)\b\s*([\s\S]*)$/.exec(block);
  if (!tag) return [];
  const named = /^(\[[^\]]*\]|\S+)\s*([\s\S]*)$/.exec(withoutType(tag[1]));
  if (!named || named[2].replace(/^-\s*/, "").trim() === "") return [];
  const root = named[1].replace(/^\[|\]$/g, "").replace(/=[\s\S]*$/, "").replace(/^\.\.\./, "");
  return [root.split(".")[0]];
}

/** The rest of an `@param`'s `text` after its `{type}`, if it has one. */
function withoutType(text: string): string {
  if (!text.startsWith("{")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    depth += text[index] === "{" ? 1 : text[index] === "}" ? -1 : 0;
    if (depth === 0) return text.slice(index + 1).trimStart();
  }
  return "";
}

/** The bindings of `param`: one for a plain, default, rest or TypeScript parameter property, one per name a pattern binds; none for `this`. */
function parameterOf(param: Node): Parameter {
  const target = parameterTarget(param);
  if (target.type === "Identifier") return { bindings: target.name === "this" ? [] : [{ name: target.name, node: target }], destructured: false };
  return { bindings: patternBindings(target), destructured: true };
}

/** The name or pattern under the default, rest or parameter-property wrapper of `param`. */
function parameterTarget(param: Node): Node {
  if (param.type === "TSParameterProperty") return parameterTarget(param.parameter);
  if (param.type === "AssignmentPattern") return parameterTarget(param.left);
  if (param.type === "RestElement") return parameterTarget(param.argument);
  return param;
}

/** Every name `pattern` binds, at any depth. */
function patternBindings(pattern: Node | null): Binding[] {
  if (!pattern) return [];
  const target = parameterTarget(pattern);
  if (target.type === "Identifier") return [{ name: target.name, node: target }];
  if (target.type === "ObjectPattern") return target.properties.flatMap((property) => patternBindings(property.type === "Property" ? property.value : property));
  if (target.type === "ArrayPattern") return target.elements.flatMap(patternBindings);
  return [];
}

/**
 * The name the message gives `signature`, as written in `sourceCode`: its own, its member's or variable's, `default` for a default
 * export, or `(anonymous)`.
 */
function signatureName(sourceCode: SourceCode, signature: Signature): string {
  if ("id" in signature && signature.id) return signature.id.name;
  if ("key" in signature) return keyText(sourceCode, signature.key);
  const documented = documentedNode(signature);
  const parent = signature.parent;
  if (parent && MEMBERS.has(parent.type)) return memberName(sourceCode, asTs<TSESTree.MethodDefinition>(parent));
  if (parent?.type === "VariableDeclarator") return sourceCode.getText(parent.id as never);
  if (parent?.type === "AssignmentExpression") return sourceCode.getText(parent.left as never);
  return documented.type === "ExportDefaultDeclaration" ? "default" : "(anonymous)";
}

/** The name of `member` as written in `sourceCode`, or `constructor`. */
function memberName(sourceCode: SourceCode, member: TSESTree.MethodDefinition): string {
  return member.kind === "constructor" ? "constructor" : keyText(sourceCode, member.key);
}

/** `key` as it reads: its name, `#name` for a private one, or its text in `sourceCode`. */
function keyText(sourceCode: SourceCode, key: Node): string {
  if (key.type === "Identifier") return key.name;
  if (key.type === "PrivateIdentifier") return `#${key.name}`;
  return sourceCode.getText(key as never);
}

export default defineJsdocRule({
  name: "jsdoc-names-every-parameter",
  type: "suggestion",
  description: "A doc comment names every parameter: in its description as a code span, or with an `@param` tag that describes it.",
  source: {
    entry: "DOC-05",
    book: "Clean Code, 2nd Edition",
    section: "§ Javadocs (and Their Ilk) in Public APIs",
    passage: "Document comments can be just as misleading, nonlocal, and dishonest as any other kind of comment.",
  },
  messages: {
    unnamed: {
      problem: "The doc comment of `{{function}}` does not name its parameter `{{name}}`.",
      refactor: "say what `{{name}}` is for in the description, naming it as `{{name}}` in backticks, or add `@param {{name}}` with a description.",
    },
  },
  create(context) {
    const check = (node: unknown) => {
      const signature = asTs<Signature>(node);
      for (const binding of unnamedBindings(context.sourceCode, signature)) {
        const data = { function: signatureName(context.sourceCode, signature), name: binding.name };
        context.report({ node: binding.node as never, messageId: "unnamed", data });
      }
    };
    return Object.fromEntries(SIGNATURES.map((type) => [type, check])) as Rule.RuleListener;
  },
});
