import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Comment, type TSESTree } from "../lib/ast.ts";
import { isDirectiveComment, isDocComment, removeComment } from "../lib/safe-fix.ts";
import { commentLines, joinLines, nameWords, proseWords, replaceCommentText, withoutLines, type CommentLine } from "../lib/comment-text.ts";

/** Words a comment may add without saying anything the name does not: stop words and accessor verbs (CMT-03). */
const IGNORED_WORDS = new Set(["the", "a", "an", "this", "of", "for", "to", "returns", "gets", "sets"]);

/** A `@param` tag with no `{type}`: its name, and the description on the tag line. */
const PARAM_TAG = /^@param[ \t]+([\w$]+)[ \t]*(?:-[ \t]*)?(.*)$/;

const contentWords = (text: string) => proseWords(text).filter((word) => !IGNORED_WORDS.has(word));

type Named = { type: string; name?: string; value?: unknown };

/** Declarations named by their `id`. */
const NAMED_BY_ID = new Set(["FunctionDeclaration", "TSDeclareFunction", "ClassDeclaration", "TSInterfaceDeclaration", "TSTypeAliasDeclaration", "TSEnumDeclaration", "TSEnumMember"]);

/** A doc comment being checked, its parts, and the words of the declaration it documents (`null` when it has no name to compare). */
interface Documented {
  comment: Comment;
  parts: DocParts;
  words: string[] | null;
}

/** Reports the doc comment of `node` once: as a whole when it only restates the name, else each `@param` tag that does. */
function checkDocComment(context: Rule.RuleContext, seen: Set<Comment>, node: TSESTree.Node): void {
  const sourceCode = context.sourceCode;
  const comment = docCommentOf(sourceCode, node);
  if (!comment || seen.has(comment)) return;
  seen.add(comment);
  const doc = { comment, parts: docParts(comment), words: declarationWords(node) };
  if (onlyRestatesName(doc.parts, doc.words)) {
    context.report({ loc: comment.loc!, messageId: "restatesName", data: { name: shownName(sourceCode, node) }, fix: (fixer) => removeComment(fixer, sourceCode, comment) });
    return;
  }
  reportRedundantParams(context, doc);
}

/** The text a report names a declaration by: its key, its id, or the whole node. */
function shownName(sourceCode: SourceCode, node: TSESTree.Node): string {
  return sourceCode.getText(("key" in node && node.key ? node.key : "id" in node && node.id ? node.id : node) as never);
}

/** Whether a doc comment with no tags says nothing its declaration's name does not. */
function onlyRestatesName(parts: DocParts, words: string[] | null): boolean {
  return words !== null && !parts.hasTags && restatesName(parts.description, words);
}

/** Reports each redundant `@param` tag; the first report carries the fix that drops them all. */
function reportRedundantParams(context: Rule.RuleContext, doc: Documented): void {
  const start = doc.comment.loc!.start.line;
  doc.parts.redundantParams.forEach((param, index) => {
    const loc = { start: { line: start + param.lines[0], column: 0 }, end: doc.comment.loc!.end };
    context.report({ loc, messageId: "restatesParam", data: { name: param.name }, ...(index === 0 ? { fix: paramsFix(context.sourceCode, doc) } : {}) });
  });
}

function paramsFix(sourceCode: SourceCode, { comment, parts, words }: Documented) {
  return (fixer: Rule.RuleFixer) => {
    const drop = new Set(parts.redundantParams.flatMap((param) => param.lines));
    const value = remainingText(comment, parts.lines, drop);
    if (onlyRestatesName(docParts({ ...comment, value } as Comment), words)) return removeComment(fixer, sourceCode, comment);
    return replaceCommentText({ fixer, sourceCode }, comment, value);
  };
}

/** The words a declaration's doc comment may repeat: its name's, and for a constructor its class's name and "default constructor". */
function declarationWords(node: TSESTree.Node): string[] | null {
  if (isConstructor(node)) {
    const owner = node.parent.parent as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
    return ["default", "constructor", ...(owner.id ? nameWords(owner.id.name) : [])];
  }
  const name = declarationName(node);
  return name === null ? null : nameWords(name);
}

function isConstructor(node: TSESTree.Node): node is TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition {
  const isMethod = node.type === "MethodDefinition" || node.type === "TSAbstractMethodDefinition";
  return isMethod && node.kind === "constructor";
}

/** The name of a declaration, or `null` when it has none this rule can compare (a computed key, a destructuring). */
function declarationName(node: TSESTree.Node): string | null {
  if (NAMED_BY_ID.has(node.type)) {
    const id = (node as { id?: Named | null }).id;
    return id ? keyName(id, { computed: false }) : null;
  }
  if (node.type === "VariableDeclaration") {
    const [only, ...rest] = node.declarations;
    return rest.length === 0 && only.id.type === "Identifier" ? only.id.name : null;
  }
  if ("key" in node && node.key) return keyName(node.key as Named, { computed: Boolean((node as { computed?: boolean }).computed) });
  return null;
}

function keyName(key: Named, { computed }: { computed: boolean }): string | null {
  if (computed) return null;
  if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name ?? null;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
}

/** The doc comment directly above `node`, if any. */
function docCommentOf(sourceCode: SourceCode, node: TSESTree.Node): Comment | null {
  const anchor = anchorOf(node);
  const comment = sourceCode.getCommentsBefore(anchor as never).at(-1);
  if (!comment || !isDocComment(comment) || isDirectiveComment(comment)) return null;
  return comment.loc!.end.line >= anchor.loc.start.line - 1 ? comment : null;
}

/** The node a declaration's doc comment sits above: the `export` around it, if any. */
function anchorOf(node: TSESTree.Node): TSESTree.Node {
  const parent = node.parent;
  return parent?.type === "ExportNamedDeclaration" || parent?.type === "ExportDefaultDeclaration" ? parent : node;
}

interface DocParts {
  lines: CommentLine[];
  /** The text before the first tag. */
  description: string;
  hasTags: boolean;
  /** The lines of each `@param` tag whose description is empty or its name split into words, and the names. */
  redundantParams: { name: string; lines: number[] }[];
}

/** The text left after dropping `drop`, with the blank lines it would leave before the comment's end dropped too. */
function remainingText(comment: Comment, lines: CommentLine[], drop: Set<number>): string {
  for (let index = lines.length - 2; index > 0 && (drop.has(index) || lines[index].content.trim() === ""); index -= 1) drop.add(index);
  return joinLines(comment, withoutLines(comment, lines, drop));
}

function docParts(comment: Comment): DocParts {
  const lines = commentLines(comment);
  const sections = tagSections(lines);
  const firstTag = sections[0]?.[0] ?? lines.length;
  const redundantParams = sections.flatMap((section) => redundantParam(lines, section));
  const description = lines.slice(0, firstTag).map((line) => line.content).join("\n");
  return { lines, description, hasTags: sections.length > 0 || description.includes("@"), redundantParams };
}

/** The `@param` tag on the lines `section`, as a one-item list when its description is empty or only its name split into words. */
function redundantParam(lines: CommentLine[], section: number[]): DocParts["redundantParams"] {
  const match = PARAM_TAG.exec(lines[section[0]].content.trim());
  if (!match) return [];
  const description = [match[2], ...section.slice(1).map((index) => lines[index].content)].join(" ");
  const words = contentWords(description);
  const repeats = words.length === 0 || words.join(" ") === nameWords(match[1]).join(" ");
  return repeats ? [{ name: match[1], lines: section }] : [];
}

/** The tags of a doc comment, each as the indexes of its lines: the line it starts on and the lines continuing it. */
function tagSections(lines: CommentLine[]): number[][] {
  const sections: number[][] = [];
  lines.forEach((line, index) => {
    if (line.content.trimStart().startsWith("@")) sections.push([index]);
    else if (sections.length > 0 && line.content.trim() !== "") sections.at(-1)!.push(index);
  });
  return sections;
}

/** Whether every content word of `text` is a word of the name. A text with no content words is not reported. */
function restatesName(text: string, words: string[]): boolean {
  const found = contentWords(text);
  return found.length > 0 && found.every((word) => words.includes(word));
}

const DECLARATIONS = [
  "FunctionDeclaration",
  "TSDeclareFunction",
  "ClassDeclaration",
  "VariableDeclaration",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
  "TSEnumDeclaration",
  "TSEnumMember",
  "MethodDefinition",
  "TSAbstractMethodDefinition",
  "PropertyDefinition",
  "TSAbstractPropertyDefinition",
  "AccessorProperty",
  "TSPropertySignature",
  "TSMethodSignature",
  "Property",
];

export default defineRule({
  name: "no-redundant-comments",
  type: "suggestion",
  description: "Delete doc comments and `@param` tags that only restate the name.",
  book: {
    entry: "CMT-03",
    chapter: "5 Comments § Redundant Comments, § Noise Comments",
    passage: "Sometimes you see comments that are nothing but noise. They restate the obvious and provide no new information.",
  },
  fixable: "code",
  messages: {
    restatesName: {
      problem: "This doc comment only restates the name `{{name}}`.",
      refactor: "delete it and let the name speak; if the reader needs more, write what the name cannot say (why, units, limits, edge cases).",
    },
    restatesParam: {
      problem: "The `@param` tag for `{{name}}` only repeats the parameter's name.",
      refactor: "delete the tag; a mandated comment that repeats the signature is clutter. Keep a `@param` only when it says what the name cannot.",
    },
  },
  create(context) {
    const seen = new Set<Comment>();
    const check = (listenerNode: unknown) => checkDocComment(context, seen, asTs(listenerNode));
    return Object.fromEntries(DECLARATIONS.map((type) => [type, check]));
  },
});
