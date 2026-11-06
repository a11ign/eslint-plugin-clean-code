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

/** The encoding a binding or member name carries, and the name without it. */
function memberEncoding(name: string): Encoding | null {
  const prefix = MEMBER_PREFIX.exec(name)?.[0] ?? HUNGARIAN.exec(name)?.[0];
  if (!prefix) return null;
  return { messageId: prefix === "m_" ? "memberPrefix" : "hungarian", prefix, suggestion: lowerFirstWord(name.slice(prefix.length)) };
}

function interfaceEncoding(name: string): Encoding | null {
  return INTERFACE_PREFIX.test(name) && !I_WORDS.test(name) ? { messageId: "interfacePrefix", prefix: "I", suggestion: name.slice(1) } : null;
}

function isEncoded(name: string): boolean {
  return memberEncoding(name) !== null || interfaceEncoding(name) !== null;
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

function isInterfaceDef(def: VariableT["defs"][number]): boolean {
  return asTs(def.node).type === "TSInterfaceDeclaration";
}

function isInParameterProperty(identifier: Node): boolean {
  const parent = identifier.parent;
  return parent?.type === "TSParameterProperty" || (parent?.type === "AssignmentPattern" && parent.parent?.type === "TSParameterProperty");
}

/** A declaration the rename may change: a local variable, a plain identifier parameter, or (for `I`) an interface. */
function isRenamableDef(def: VariableT["defs"][number], forInterface: boolean): boolean {
  const name = asTs(def.name);
  if (forInterface) return isInterfaceDef(def);
  if (def.type === "Variable") return true;
  if (def.type !== "Parameter") return false;
  const owner = name.parent as { params?: Node[] } | undefined;
  return owner?.params?.includes(name) ?? false;
}

interface Candidate {
  messageId: MessageId;
  node: Node;
  data: Record<string, string>;
  /** The rename, when every condition but the name being unique among the file's renames holds. */
  rename: ((fixer: Rule.RuleFixer) => Rule.Fix[]) | null;
  newName: string;
}

function canRenameVariable(variable: VariableT, encoding: Encoding, filename: string): boolean {
  const forInterface = encoding.messageId === "interfacePrefix";
  const defNames = variable.defs.map((def) => asTs(def.name));
  if (!variable.defs.every((def) => isRenamableDef(def, forInterface))) return false;
  if (defNames.some((name) => isAmbient(name, filename) || isExportedDeclaration(name))) return false;
  const identifiers = variableIdentifiers(variable);
  if (identifiers.some((identifier) => isShorthand(identifier) || isInImportOrExport(identifier) || receivesNamedFunction(identifier))) return false;
  const newName = encoding.suggestion;
  return isBindableName(newName) && !isEncoded(newName) && isNameFree(variable.scope, newName) && !usesEval(variable.scope);
}

function variableCandidate(variable: VariableT, sourceCode: SourceCode, filename: string): Candidate | null {
  const first = asTs(variable.defs[0].name);
  if (isInParameterProperty(first)) return null;
  const encoding = variable.defs.some(isInterfaceDef) ? interfaceEncoding(variable.name) : memberEncoding(variable.name);
  if (!encoding) return null;
  const fixable = isEsModuleFile(sourceCode) && canRenameVariable(variable, encoding, filename);
  return {
    messageId: encoding.messageId,
    node: first,
    data: { name: variable.name, prefix: encoding.prefix, suggestion: encoding.suggestion },
    newName: encoding.suggestion,
    rename: fixable ? (fixer) => renameAll(fixer, variableIdentifiers(variable), variable.name, encoding.suggestion) : null,
  };
}

type Member = TSESTree.PropertyDefinition | TSESTree.MethodDefinition | TSESTree.AccessorProperty | TSESTree.TSAbstractPropertyDefinition | TSESTree.TSAbstractMethodDefinition | TSESTree.TSAbstractAccessorProperty;

/** The `#private` names a class body declares. */
function declaredPrivateNames(body: TSESTree.ClassBody): Set<string> {
  const names = new Set<string>();
  for (const member of body.body) {
    const key = (member as { key?: Node }).key;
    if (key?.type === "PrivateIdentifier") names.add(key.name);
  }
  return names;
}

/** The class body a `#name` refers to: the nearest one around it that declares that name. */
function privateOwner(identifier: TSESTree.PrivateIdentifier): Node | null {
  for (let current: Node | undefined = identifier.parent; current; current = current.parent) {
    if (current.type === "ClassBody" && declaredPrivateNames(current).has(identifier.name)) return current;
  }
  return null;
}

function within(node: Node, outer: Node): boolean {
  return node.range[0] >= outer.range[0] && node.range[1] <= outer.range[1];
}

/** Renames a `#private` field: each `#name` that refers to it, when the new name appears nowhere in the class. */
function privateRename(member: TSESTree.PropertyDefinition, encoding: Encoding, privates: TSESTree.PrivateIdentifier[], sourceCode: SourceCode) {
  const key = member.key as TSESTree.PrivateIdentifier;
  const body = member.parent as TSESTree.ClassBody;
  const inClass = privates.filter((identifier) => within(identifier, body));
  if (inClass.some((identifier) => identifier.name === encoding.suggestion)) return null;
  const own = inClass.filter((identifier) => identifier.name === key.name && privateOwner(identifier) === body);
  return (fixer: Rule.RuleFixer) =>
    own.map((identifier) => {
      const start = identifier.range[0] + (sourceCode.text[identifier.range[0]] === "#" ? 1 : 0);
      return fixer.replaceTextRange([start, start + key.name.length], encoding.suggestion);
    });
}

function canRenameMember(member: Member, sourceCode: SourceCode, filename: string): member is TSESTree.PropertyDefinition {
  if (member.type !== "PropertyDefinition" || member.computed || member.key.type !== "PrivateIdentifier") return false;
  return isEsModuleFile(sourceCode) && !isAmbient(member, filename) && !isAnonymousFunctionOrClass(member.value);
}

function memberCandidate(member: Member, privates: TSESTree.PrivateIdentifier[], sourceCode: SourceCode, filename: string): Candidate | null {
  const key = member.key;
  if (member.computed || (key.type !== "Identifier" && key.type !== "PrivateIdentifier")) return null;
  const encoding = memberEncoding(key.name);
  if (!encoding) return null;
  const newName = encoding.suggestion;
  const fixable = /^[A-Za-z_$][\w$]*$/.test(newName) && !isEncoded(newName) && canRenameMember(member, sourceCode, filename);
  return {
    messageId: encoding.messageId,
    node: key,
    data: { name: key.type === "PrivateIdentifier" ? `#${key.name}` : key.name, prefix: encoding.prefix, suggestion: key.type === "PrivateIdentifier" ? `#${newName}` : newName },
    newName: key.type === "PrivateIdentifier" ? `#${newName}` : newName,
    rename: fixable ? privateRename(member as TSESTree.PropertyDefinition, encoding, privates, sourceCode) : null,
  };
}

function parameterPropertyCandidate(node: TSESTree.TSParameterProperty): Candidate | null {
  const identifier = node.parameter.type === "AssignmentPattern" ? node.parameter.left : node.parameter;
  if (identifier.type !== "Identifier") return null;
  const encoding = memberEncoding(identifier.name);
  if (!encoding) return null;
  return { messageId: encoding.messageId, node: identifier, data: { name: identifier.name, prefix: encoding.prefix, suggestion: encoding.suggestion }, newName: encoding.suggestion, rename: null };
}

/**
 * Reports each candidate once (a class name is bound both around the class and inside it). Two renames to the same new
 * name would collide with each other, so neither is applied.
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
    const sourceCode = context.sourceCode;
    const filename = context.filename;
    const privates: TSESTree.PrivateIdentifier[] = [];
    const members: Member[] = [];
    const parameterProperties: TSESTree.TSParameterProperty[] = [];
    const collectMember = (node: unknown) => members.push(asTs<Member>(node));
    return {
      PrivateIdentifier: (node: unknown) => privates.push(asTs<TSESTree.PrivateIdentifier>(node)),
      PropertyDefinition: collectMember,
      MethodDefinition: collectMember,
      AccessorProperty: collectMember,
      TSAbstractPropertyDefinition: collectMember,
      TSAbstractMethodDefinition: collectMember,
      TSAbstractAccessorProperty: collectMember,
      TSParameterProperty: (node: unknown) => parameterProperties.push(asTs<TSESTree.TSParameterProperty>(node)),
      "Program:exit"() {
        const candidates = [
          ...declaredVariables(sourceCode).map((variable) => variableCandidate(variable, sourceCode, filename)),
          ...members.map((member) => memberCandidate(member, privates, sourceCode, filename)),
          ...parameterProperties.map(parameterPropertyCandidate),
        ].filter((candidate): candidate is Candidate => candidate !== null);
        reportAll(context, candidates);
      },
    } as Rule.RuleListener;
  },
});

rule.meta.messages!.interfacePrefix = bookMessage(INTERFACE_MESSAGE, NAM_10);

export default rule;
