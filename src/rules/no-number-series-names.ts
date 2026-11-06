import { defineRule } from "../lib/define-rule.ts";
import { asTs } from "../lib/ast.ts";
import { words } from "../lib/names.ts";
import { allScopes, type VariableT } from "../lib/naming.ts";

const NUMBERED = /^(.*?[A-Za-z$])_?(\d+)$/;

/** Terms whose digits are part of the word, so names ending in them do not form a series (`sha1` and `sha256`). */
const TERMS = new Set([
  "md4", "md5", "sha1", "sha224", "sha256", "sha384", "sha512", "crc16", "crc32", "crc64",
  "utf7", "utf8", "utf16", "utf32", "ucs2", "base16", "base32", "base36", "base58", "base62", "base64", "base85",
  "int8", "int16", "int32", "int64", "int128", "uint8", "uint16", "uint32", "uint64", "uint128", "float16", "float32",
  "float64", "bigint64", "biguint64", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "f32", "f64",
  "x86", "x64", "amd64", "arm64", "aarch64", "win32", "win64", "ipv4", "ipv6", "http1", "http2", "http3", "oauth1",
  "oauth2", "h264", "h265", "vp8", "vp9", "av1", "mp3", "mp4", "s3", "ec2", "vec2", "vec3", "vec4", "mat2", "mat3",
  "mat4", "es5", "es6", "html5", "css3", "ie11", "p2p", "b2b", "e2e",
]);

const VERSIONED_TERM = /^(es|ecma|es20)\d+$/;

/** The stem of a number-series name (`list` for `list1` and `list_2`), or `null` when the digits are part of a term. */
function seriesStem(name: string): string | null {
  const match = NUMBERED.exec(name);
  if (!match) return null;
  const stem = match[1];
  const last = words(name).at(-1) ?? "";
  if (TERMS.has(last) || VERSIONED_TERM.test(last)) return null;
  return stem.length > 1 ? stem : null;
}

/** The series in one scope: each stem with the numbered names, and the bare stem if it is declared too. */
function seriesIn(variables: VariableT[]): Map<string, VariableT[]> {
  const byStem = new Map<string, VariableT[]>();
  for (const variable of variables) {
    const stem = seriesStem(variable.name);
    if (stem) byStem.set(stem, [...(byStem.get(stem) ?? []), variable]);
  }
  const names = new Set(variables.map((variable) => variable.name));
  for (const [stem, numbered] of byStem) {
    if (numbered.length + (names.has(stem) ? 1 : 0) < 2) byStem.delete(stem);
  }
  return byStem;
}

export default defineRule({
  name: "no-number-series-names",
  type: "suggestion",
  description: "Make meaningful distinctions: no bindings in one scope that differ only by a trailing number (`list1`, `list2`).",
  book: {
    entry: "NAM-04",
    chapter: "4 Meaningful Names § Make Meaningful Distinctions",
    passage: "Number-series naming ( `a1` , `a2` , ... `aN` ) is the opposite of intentional naming. Such names are not dis-informative, they are uninformative; they provide no clue to the author's intention.",
  },
  messages: {
    series: {
      problem: "`{{name}}` differs from {{others}} in the same scope only by its number.",
      refactor: "give each binding a name that says how its value differs from the others (`source` and `destination`, not `a1` and `a2`).",
    },
  },
  create(context) {
    return {
      "Program:exit"() {
        for (const scope of allScopes(context.sourceCode)) {
          const variables = scope.variables.filter((variable) => variable.defs.length > 0);
          const names = new Set(variables.map((variable) => variable.name));
          for (const [stem, numbered] of seriesIn(variables)) {
            const series = [...(names.has(stem) ? [stem] : []), ...numbered.map((variable) => variable.name)];
            for (const variable of numbered) {
              const others = series.filter((name) => name !== variable.name).map((name) => `\`${name}\``).join(", ");
              context.report({ node: asTs(variable.defs[0].name) as never, messageId: "series", data: { name: variable.name, others } });
            }
          }
        }
      },
    };
  },
});
