import type { Rule, SourceCode } from "eslint";
import { bookMessage, defineRule, type BookSource } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import {
  declaredVariables,
  isAmbient,
  isAnonymousFunctionOrClass,
  isBindableName,
  isEsModuleFile,
  isExportedDeclaration,
  isInImportOrExport,
  isNameFree,
  isShorthand,
  lowerFirstWord,
  receivesNamedFunction,
  renameAll,
  usesEval,
  variableIdentifiers,
  type VariableT,
} from "../lib/naming.ts";

const MEMBER_PREFIX = /^m_(?=.)/;
const HUNGARIAN = /^(str|sz)(?=[A-Z])/;
const INTERFACE_PREFIX = /^I(?=[A-Z][a-z])/;
/** Words that start with `I` and a capital, so a name starting with them has no `I` prefix (`IFrameProps`). */
const I_WORDS = /^IFrame(?![a-z])/;

type MessageId = "memberPrefix" | "hungarian" | "interfacePrefix";

interface Encoding {
  messageId: MessageId;
  prefix: string;
  suggestion: string;
}

const NAM_10: BookSource = {
  entry: "NAM-10",
  chapter: "4 Meaningful Names § Interfaces and Implementations",
  passage: "We do not recommend prefixing interfaces with `I` , because that's just another kind of type encoding.",
};

const INTERFACE_MESSAGE = {
  problem: "Interface `{{name}}` is prefixed with `I`; without it the name is `{{suggestion}}`.",
  refactor: "drop the `I` and leave the interface unadorned; if the interface and its implementation need different names, encode the implementation (`ShapeFactoryImp`).",
};

interface Candidate {
  messageId: MessageId;
  node: Node;
  data: Record<string, string>;
  /** The rename, when every condition but the name being unique among the file's renames holds. */
  rename: ((fixer: Rule.RuleFixer) => Rule.Fix[]) | null;
  newName: string;
}

/** The file being linted, and the `#private` names in it. */
interface LintedFile {
  sourceCode: SourceCode;
  filename: string;
  privates: TSESTree.PrivateIdentifier[];
}

type NamedKey = TSESTree.Identifier | TSESTree.PrivateIdentifier;

type Member = TSESTree.PropertyDefinition | TSESTree.MethodDefinition | TSESTree.AccessorProperty | TSESTree.TSAbstractPropertyDefinition | TSESTree.TSAbstractMethodDefinition | TSESTree.TSAbstractAccessorProperty;

function memberCollectors(members: Member[]): Rule.RuleListener {
  const collectMember = (node: unknown) => members.push(asTs<Member>(node));
  return {
    PropertyDefinition: collectMember,
    MethodDefinition: collectMember,
    AccessorProperty: collectMember,
    TSAbstractPropertyDefinition: collectMember,
    TSAbstractMethodDefinition: collectMember,
    TSAbstractAccessorProperty: collectMember,
  };
}

function allCandidates(file: LintedFile, members: Member[], parameterProperties: TSESTree.TSParameterProperty[]): Candidate[] {
  return [
    ...declaredVariables(file.sourceCode).map((variable) => variableCandidate(variable, file)),
    ...members.map((member) => memberCandidate(member, file)),
    ...parameterProperties.map(parameterPropertyCandidate),
  ].filter((candidate): candidate is Candidate => candidate !== null);
}

function variableCandidate(variable: VariableT, file: LintedFile): Candidate | null {
  const first = asTs<TSESTree.Identifier>(variable.defs[0].name);
  if (isInParameterProperty(first)) return null;
  const encoding = variable.defs.some(isInterfaceDef) ? interfaceEncoding(variable.name) : memberEncoding(variable.name);
  if (!encoding) return null;
  const fixable = isEsModuleFile(file.sourceCode) && canRenameVariable(variable, encoding, file.filename);
  return nameCandidate(first, encoding, fixable ? (fixer) => renameAll(fixer, variableIdentifiers(variable), { from: variable.name, to: encoding.suggestion }) : null);
}

function isInParameterProperty(identifier: Node): boolean {
  const parent = identifier.parent;
  return parent?.type === "TSParameterProperty" || (parent?.type === "AssignmentPattern" && parent.parent?.type === "TSParameterProperty");
}

function interfaceEncoding(name: string): Encoding | null {
  return INTERFACE_PREFIX.test(name) && !I_WORDS.test(name) ? { messageId: "interfacePrefix", prefix: "I", suggestion: name.slice(1) } : null;
}

/** The encoding the binding or member `name` carries, and the name without it. */
function memberEncoding(name: string): Encoding | null {
  const prefix = MEMBER_PREFIX.exec(name)?.[0] ?? HUNGARIAN.exec(name)?.[0];
  if (!prefix) return null;
  return { messageId: prefix === "m_" ? "memberPrefix" : "hungarian", prefix, suggestion: lowerFirstWord(name.slice(prefix.length)) };
}

function isInterfaceDef(def: VariableT["defs"][number]): boolean {
  return asTs(def.node).type === "TSInterfaceDeclaration";
}

function canRenameVariable(variable: VariableT, encoding: Encoding, filename: string): boolean {
  const forInterface = encoding.messageId === "interfacePrefix";
  const defNames = variable.defs.map((def) => asTs(def.name));
  if (!variable.defs.every((def) => isRenamableDef(def, { forInterface }))) return false;
  if (defNames.some((name) => isAmbient(name, filename) || isExportedDeclaration(name))) return false;
  const identifiers = variableIdentifiers(variable);
  if (identifiers.some((identifier) => isShorthand(identifier) || isInImportOrExport(identifier) || receivesNamedFunction(identifier))) return false;
  const newName = encoding.suggestion;
  return isBindableName(newName) && !isEncoded(newName) && isNameFree(variable.scope, newName) && !usesEval(variable.scope);
}

/** Whether the rename may change the declaration `def`: a local variable or a plain identifier parameter, or, `forInterface` (for `I`), an interface. */
function isRenamableDef(def: VariableT["defs"][number], { forInterface }: { forInterface: boolean }): boolean {
  const name = asTs(def.name);
  if (forInterface) return isInterfaceDef(def);
  if (def.type === "Variable") return true;
  if (def.type !== "Parameter") return false;
  const owner = name.parent as { params?: Node[] } | undefined;
  return owner?.params?.includes(name) ?? false;
}

function isEncoded(name: string): boolean {
  return memberEncoding(name) !== null || interfaceEncoding(name) !== null;
}

/** The report for `identifier`, whose name carries `encoding`, fixed by `rename`; a `#private` name keeps its `#` in the message and the new name. */
function nameCandidate(identifier: NamedKey, encoding: Encoding, rename: Candidate["rename"]): Candidate {
  const sigil = identifier.type === "PrivateIdentifier" ? "#" : "";
  const newName = `${sigil}${encoding.suggestion}`;
  return { messageId: encoding.messageId, node: identifier, data: { name: `${sigil}${identifier.name}`, prefix: encoding.prefix, suggestion: newName }, newName, rename };
}

function memberCandidate(member: Member, file: LintedFile): Candidate | null {
  const key = namedKey(member);
  if (!key) return null;
  const encoding = memberEncoding(key.name);
  if (!encoding) return null;
  const fixable = /^[A-Za-z_$][\w$]*$/.test(encoding.suggestion) && !isEncoded(encoding.suggestion) && canRenameMember(member, file);
  return nameCandidate(key, encoding, fixable ? privateRename(member as TSESTree.PropertyDefinition, encoding, file) : null);
}

/** The key of `member` when it is not computed and is a name or a `#private` name. */
function namedKey(member: Member): NamedKey | null {
  if (member.computed) return null;
  const key = member.key;
  return key.type === "Identifier" || key.type === "PrivateIdentifier" ? key : null;
}

function canRenameMember(member: Member, file: LintedFile): member is TSESTree.PropertyDefinition {
  if (member.type !== "PropertyDefinition" || member.computed || member.key.type !== "PrivateIdentifier") return false;
  return isEsModuleFile(file.sourceCode) && !isAmbient(member, file.filename) && !isAnonymousFunctionOrClass(member.value);
}

/**
 * Renames the `#private` field `member` to the suggestion of its `encoding`: each `#name` in `file` that refers to it, when
 * the new name appears nowhere in the class.
 */
function privateRename(member: TSESTree.PropertyDefinition, encoding: Encoding, file: LintedFile) {
  const key = member.key as TSESTree.PrivateIdentifier;
  const body = member.parent as TSESTree.ClassBody;
  const inClass = file.privates.filter((identifier) => within(identifier, body));
  if (inClass.some((identifier) => identifier.name === encoding.suggestion)) return null;
  const own = inClass.filter((identifier) => identifier.name === key.name && privateOwner(identifier) === body);
  return (fixer: Rule.RuleFixer) =>
    own.map((identifier) => {
      const start = identifier.range[0] + (file.sourceCode.text[identifier.range[0]] === "#" ? 1 : 0);
      return fixer.replaceTextRange([start, start + key.name.length], encoding.suggestion);
    });
}

function within(node: Node, outer: Node): boolean {
  return node.range[0] >= outer.range[0] && node.range[1] <= outer.range[1];
}

/** The class body the `#name` in `identifier` refers to: the nearest one around it that declares that name. */
function privateOwner(identifier: TSESTree.PrivateIdentifier): Node | null {
  for (let current: Node | undefined = identifier.parent; current; current = current.parent) {
    if (current.type === "ClassBody" && declaredPrivateNames(current).has(identifier.name)) return current;
  }
  return null;
}

/** The `#private` names class `body` declares. */
function declaredPrivateNames(body: TSESTree.ClassBody): Set<string> {
  const names = new Set<string>();
  for (const member of body.body) {
    const key = (member as { key?: Node }).key;
    if (key?.type === "PrivateIdentifier") names.add(key.name);
  }
  return names;
}

function parameterPropertyCandidate(node: TSESTree.TSParameterProperty): Candidate | null {
  const identifier = node.parameter.type === "AssignmentPattern" ? node.parameter.left : node.parameter;
  if (identifier.type !== "Identifier") return null;
  const encoding = memberEncoding(identifier.name);
  return encoding ? nameCandidate(identifier, encoding, null) : null;
}

/**
 * Reports through `context` each candidate in `all` once (a class name is bound both around the class and inside it). Two
 * renames to the same new name would collide with each other, so neither is applied.
 */
function reportAll(context: Rule.RuleContext, all: Candidate[]): void {
  const byStart = new Map(all.map((candidate) => [candidate.node.range[0], candidate]));
  const candidates = [...byStart.values()];
  const counts = new Map<string, number>();
  for (const candidate of candidates) if (candidate.rename) counts.set(candidate.newName, (counts.get(candidate.newName) ?? 0) + 1);
  for (const candidate of candidates) {
    const rename = counts.get(candidate.newName) === 1 ? candidate.rename : null;
    context.report({ node: candidate.node as never, messageId: candidate.messageId, data: candidate.data, ...(rename ? { fix: rename } : {}) });
  }
}

const rule = defineRule({
  name: "no-encodings",
  type: "suggestion",
  description: "Leave type and scope encodings out of names: no `m_` member prefix, no Hungarian `str`/`sz` prefix, no `I` on interfaces.",
  book: {
    entry: "NAM-09",
    chapter: "4 Meaningful Names § Member Prefixes",
    passage: "Prefixing member variables with something like `m_` is another form of type encoding that is no longer necessary. Your classes and functions should be small enough that you don't need such a crutch.",
  },
  fixable: "code",
  messages: {
    memberPrefix: {
      problem: "`{{name}}` starts with the member prefix `m_`; without it the name is `{{suggestion}}`.",
      refactor: "drop the prefix, and keep classes and functions small enough that their members need no marker.",
    },
    hungarian: {
      problem: "`{{name}}` encodes its type in the Hungarian prefix `{{prefix}}`; without it the name is `{{suggestion}}`.",
      refactor: "drop the prefix and let the declared type say what the value is.",
    },
    interfacePrefix: INTERFACE_MESSAGE,
  },
  create(context) {
    const file: LintedFile = { sourceCode: context.sourceCode, filename: context.filename, privates: [] };
    const members: Member[] = [];
    const parameterProperties: TSESTree.TSParameterProperty[] = [];
    return {
      ...memberCollectors(members),
      PrivateIdentifier: (node: unknown) => file.privates.push(asTs<TSESTree.PrivateIdentifier>(node)),
      TSParameterProperty: (node: unknown) => parameterProperties.push(asTs<TSESTree.TSParameterProperty>(node)),
      "Program:exit": () => reportAll(context, allCandidates(file, members, parameterProperties)),
    } as Rule.RuleListener;
  },
});

rule.meta.messages!.interfacePrefix = bookMessage(INTERFACE_MESSAGE, NAM_10);

export default rule;
