# Catalog: the rules of *Clean Code, 2nd Edition*, and how this plugin checks them

This catalog is the plan for every rule in this plugin. It lists each rule, heuristic and smell in *Clean Code: A Handbook of Agile Software Craftsmanship, Second Edition* (Robert C. Martin) that says something about source code. For each one, it records how the plugin checks it. No rule is written until this catalog is approved.

Each entry gives:

- **Chapter**: the book's chapter number and title, and the section heading the passage sits under.
- **bookCTX**: where the quoted passage is. Every citation refers to the book `clean-code-a-handbook-of-agile-software-craftsmanship-second-edition` in the bookCTX library, at the chunk named. `chunk 13` means `get_chunk(book_slug="clean-code-a-handbook-of-agile-software-craftsmanship-second-edition", chunk=13)`.
- **Quote**: the passage, copied verbatim from that chunk, including the extraction's own spacing before punctuation (for example "`List` .").
- **Class**: one of four.
  - **syntax**: a custom rule that needs only the syntax tree and scope analysis. It runs under ESLint and Oxlint, and goes in `recommended`.
  - **types**: a custom rule that needs TypeScript type information. It runs under ESLint only, and goes in `recommended-type-checked`.
  - **built-in**: a rule that ESLint core or typescript-eslint already has, and that Oxlint also runs natively. It goes in `recommended` as configuration only. `recommended` needs typescript-eslint installed: its parser reads TypeScript, and one of its rules (CD-04) also runs on JavaScript. That makes typescript-eslint a peer dependency, including for projects with only JavaScript.
  - **not lintable**: the reason is given.
- **Rule**, **threshold** and **fix**: for every entry that is not "not lintable". Where the book states the threshold, the entry quotes it. Where it doesn't, the entry gives the value chosen and why. Every custom rule either has an autofix that leaves behaviour unchanged, or a "why there is no autofix" note.

Every rule in `recommended` and `recommended-type-checked` is set to `error`, as decided for this plugin. Projects turn rules down or off in their own config.

## What the owner is asked to approve

Approving this pull request approves the items below. Each one is a choice the book leaves open.

1. **Package name.** `eslint-plugin-clean-code` is taken on npm (pksilen, 0.1.12). The plan says to take the closest free unscoped name. This catalog uses **`eslint-plugin-clean-code-book`** and the rule prefix `clean-code-book/`. A closer spelling, `eslint-plugin-cleancode`, is also free, but it equals the taken name once punctuation is removed. npm's similar-name check would likely refuse it, and readers would confuse the two, which is the "names that differ only slightly" smell (entry NAM-05). The repository keeps its name.
2. **Thresholds the book does not state.** These are marked **Owner sign-off** in their entries and collected under [Thresholds the book does not state](#thresholds-the-book-does-not-state).
3. **Interpretations of a stated threshold, and other choices.** For example, how "indent level" maps to `max-depth`. Each is marked **Owner sign-off** in its entry:
   - interpretations: FN-01, FN-03, FN-04, FN-05 and CLS-01, collected in the second table under [Thresholds the book does not state](#thresholds-the-book-does-not-state).
   - choices: FP-03 (no `no-magic-numbers`), CMT-08 (no issue-key check), CMT-10 (`fixme`), NAM-06 (`I`), FH-03 (accumulators exempt, getOrCreate with a passed-in cache reported), FN-02 (large union switches reported), OBJ-01 (getOrCreate callers reported) and TST-01 (`max-lines-per-function` off in test files).
4. **Custom rules without an autofix.** Each is listed under [Custom rules with no autofix](#custom-rules-with-no-autofix) with its reason. Its rule doc will carry a "Why there is no autofix" section.
5. **How the known failures of `@george2f/eslint-plugin-clean-code` are kept out.** See [Regression cases](#regression-cases). Some rules still report a getOrCreate, a fluent setter, a parameter object or a discriminated union in a stated case. Each one is listed there with the reason, for approval.
6. **Rules that override another acceptance line on purpose.** Some fixes apply only when the whole change fits in one file (FH-01 and others; see [Partial fixes](#custom-rules-with-no-autofix)). For the cases outside that, "the fixed code no longer triggers the rule" does not hold: the rule reports and does not fix.
7. **Quotations in a public repository.** This repository is public and Apache-2.0, but the quoted passages are the publisher's text, not ours. About 150 short passages appear here, each with a citation and used for commentary. Pushing this branch has already put them on GitHub. Before this pull request merges, the owner should decide whether they stay, or whether the catalog should keep only the citations.

## The rule set at a glance

| Rule | Entry | Config | Threshold | Fix |
| --- | --- | --- | --- | --- |
| `max-params` | FN-04 | recommended | 3 (book), `countThis: "never"` | built-in: none |
| `max-lines-per-function` | FN-01 | recommended | 12 lines (book, interpreted) | built-in: none |
| `max-depth` | FN-03 | recommended | 2 (book, interpreted) | built-in: none |
| `complexity` | FN-02 | recommended | 15 (owner sign-off) | built-in: none |
| `max-lines` | FMT-01 | recommended | 500 (book) | built-in: none |
| `max-classes-per-file` | CLS-01 | recommended | 1 (book) | built-in: none |
| `no-else-return` | CD-02 | recommended | `allowElseIf: false` | built-in fix |
| `no-unneeded-ternary` | CD-01 | recommended | defaults | built-in fix |
| `no-labels` | FH-12 | recommended | none | built-in: none |
| `no-warning-comments` | CMT-10 | recommended | terms `todo`, `fixme` (owner sign-off) | built-in: none |
| `no-param-reassign` | FH-03 | recommended | `props: true`, accumulators exempt (owner sign-off) | built-in: none |
| `no-fallthrough` | CLS-05 | recommended | none | built-in: none |
| `no-unreachable` | HRM-01 | recommended | none | built-in: none |
| `no-unused-vars`, `@typescript-eslint/no-unused-vars` | HRM-01 | recommended | import and variable fixes off | built-in: none |
| `no-empty` | FH-08 | recommended | `allowEmptyCatch: false` | built-in: none |
| `id-denylist` | NAM-06, NAM-07 | recommended | `l`, `O`, `I` (owner sign-off), `klass`, `clazz` | built-in: none |
| `@typescript-eslint/prefer-for-of` | CD-04 | recommended | none | built-in: none |
| `no-flag-argument` | FH-01 | recommended | none | **fix** (partial) |
| `error-handling-is-one-thing` | FH-07 | recommended | none | no fix |
| `max-block-statements` | FN-05, FH-06 | recommended | 2 (book, interpreted) | no fix |
| `return-boolean-directly` | CD-01 | recommended | none | **fix** |
| `stepdown-order` | FMT-04 | recommended | none | **fix** (function declarations) |
| `fields-first` | FMT-03 | recommended | none | **fix** (partial) |
| `no-protected-fields` | FMT-02 | recommended | none | no fix |
| `no-commented-out-code` | CMT-11 | recommended | none | **fix** |
| `no-journal-comments` | CMT-06 | recommended | 3 dated lines (owner sign-off) | **fix** |
| `no-attribution-comments` | CMT-08 | recommended | none | **fix** (partial) |
| `no-position-markers` | CMT-07 | recommended | 5 repeated characters (owner sign-off) | **fix** |
| `no-html-in-comments` | CMT-09 | recommended | none | **fix** (partial) |
| `no-redundant-comments` | CMT-03, CMT-04, CMT-05 | recommended | none | **fix** |
| `no-encodings` | NAM-09, NAM-10 | recommended | none | **fix** (partial) |
| `no-noise-words` | NAM-08, NAM-11 | recommended | none | no fix |
| `no-number-series-names` | NAM-04 | recommended | none | no fix |
| `name-length-matches-scope` | NAM-02 | recommended | 1-letter names in scopes of ≤ 3 lines (owner sign-off) | no fix |
| `no-side-effects-in-predicates` | NAM-12 | recommended | none | no fix |
| `no-command-query-mix` | FH-04 | recommended | none | no fix |
| `no-pure-delegator` | ONE-02 | recommended | none | **fix** (partial) |
| `one-switch-per-type` | OBJ-05 | recommended | 1 (book) | no fix |
| `no-getter-chains` | OBJ-02 | recommended | 2 chained getters (owner sign-off) | no fix |
| `no-hybrid-class` | OBJ-04 | recommended | none | no fix |
| `no-trivial-accessors` | OBJ-03 | recommended | none | no fix |
| `no-complex-condition` | ONE-04 | recommended | mixed `&&`/`\|\|`, or > 3 operands (owner sign-off) | no fix |
| `no-mutable-static-state` | ONE-05 | recommended | none | no fix |
| `no-overloaded-constructors` | NAM-13 | recommended | none | no fix |
| `loop-variable-in-loop` | FMT-05 | recommended | none | **fix** (partial) |
| `no-disabled-tests` | TST-07 | recommended | none | no fix |
| `test-asserts` | TST-05 | recommended | none | no fix |
| `no-shared-test-state` | TST-04 | recommended | none | no fix |
| `law-of-demeter` | OBJ-01 | recommended-type-checked | none | no fix |
| `no-container-in-name` | NAM-03 | recommended-type-checked | none | no fix |
| `predicate-returns-boolean` | NAM-12 | recommended-type-checked | none | no fix |
| `no-command-query-mix` (method calls) | FH-04 | recommended-type-checked | none | no fix |
| `no-concrete-inheritance` | SOL-05, SOL-06 | recommended-type-checked | none | no fix |
| `no-subtype-check` | SOL-03 | recommended-type-checked | none | no fix |

The README will not say which projects this replaces. The pull request body records that `recommended` covers the five limits that some projects copy by hand today: function length, complexity, depth, parameters and empty blocks.

## Entries

### Chapter 2, Clean That Code! and Chapter 3, First Principles

#### FP-01 · Keep everything small, well named, organized and ordered

- **Chapter:** 3 First Principles § Everything Small, Well Named, Organized, and Ordered. **bookCTX:** chunk 5
- **Quote:** "Keep everything small. Choose names for those small elements that communicate to other programmers. Define and maintain a structure and organization that present the software in such a way that others can easily consume it."
- **Class:** not lintable. This is the umbrella principle. Its checkable parts are FN-01, FMT-01, FMT-04 and the naming entries.

#### FP-02 · Don't be clever

- **Chapter:** 2 Clean That Code! § The Cleaning Process. **bookCTX:** chunk 4
- **Quote:** "I really didn't like the ad hoc "49FNGO" character replacement for the digraphs. That was just too clever."
- **Class:** not lintable. Cleverness is a judgment about intent, and no syntax pattern marks it. Narrow proxies such as `no-bitwise` would ban legitimate code the book does not object to.

#### FP-03 · Replace magic numbers with named constants

- **Chapter:** 2 Clean That Code! § The Cleaning Process; 4 Meaningful Names § Use Searchable Names. **bookCTX:** chunks 4, 8
- **Quote:** "After that, it was just a matter of reducing all the duplication in the cases and removing as many of the magic numbers as possible."
- **Class:** not lintable as an error-level rule. The book says "as many of the magic numbers as possible", not all. Core `no-magic-numbers` reports every literal outside a short ignore list, and an audit of `@george2f/eslint-plugin-clean-code` kept its equivalent off for flooding real code. The plugin leaves it to projects. **Owner sign-off:** this is a deliberate omission of a rule ESLint has.

#### FP-04 · Name the operation instead of passing a negated argument

- **Chapter:** 3 First Principles § Functions. **bookCTX:** chunk 5
- **Quote:** "I don't like the leading minus sign. It would have been better to create a `subtractDays` function in order to get rid of it. That's a small thing, but small things matter."
- **Class:** not lintable. `f(-x)` is often correct (offsets, signs, coordinates). Telling which calls should be a separate, named operation needs to know what the function means.

#### FP-05 · Separate what changes for different reasons (SRP at function level)

- **Chapter:** 3 First Principles § A More Significant Example. **bookCTX:** chunk 6
- **Quote:** "So first, let's just use the extract method refactoring to create functions that do one thing, and gather together the things that are related and separate the things that are different."
- **Class:** not lintable. Which parts change for different stakeholders is not in the code. FN-01 and FN-02 are the size proxies.

#### FP-06 · YAGNI: count the cost before making room for growth

- **Chapter:** 3 First Principles § A More Significant Example; 18 Simple Design § YAGNI. **bookCTX:** chunks 6, 25
- **Quote:** "If the cost of leaving the hook out was tolerable, then you probably shouldn't put it in. If the cost of carrying the hook in the design year after year would be high while the odds that you'd eventually need that hook were low, you probably shouldn't put that hook in."
- **Class:** not lintable. Whether a hook will be needed is a forecast.

#### FP-07 · Trade speed for clarity, within reason

- **Chapter:** 2 Clean That Code!. **bookCTX:** chunk 4
- **Quote:** "But for my purposes, the extra time is the least of my concerns. I don't need the speed. For my situation, I think trading speed for clarity, within reason, is a good trade to make."
- **Class:** not lintable. This is a design trade-off. It is why no rule in this plugin carries a performance exemption.

### Chapter 4, Meaningful Names

#### NAM-01 · Use intention-revealing names; a name that needs a comment doesn't reveal intent

- **Chapter:** 4 Meaningful Names § Use Intention-Revealing Names. **bookCTX:** chunk 8
- **Quote:** "If a name requires a comment to communicate to its audience, then the name does not reveal its intent."
- **Class:** not lintable. A trailing comment on a declaration is a weak signal: it also marks units, references and warnings, which the book calls good comments (CMT-02). Whether a name reveals intent is semantic.

#### NAM-02 · Name length proportional to the scope that contains it

- **Chapter:** 4 Meaningful Names § Use Searchable Names, § Variable Names. **bookCTX:** chunk 8
- **Quote:** "Our preference is that very short, or single-letter, names ought *only* to be used as local variables inside very short scopes. If a variable or constant might be seen or used in multiple places in a body of code, it is best to give it a search-friendly name."
- **Class:** syntax.
- **Rule:** `name-length-matches-scope`. It reports a one-letter binding (variable, parameter or function) whose scope spans more than the threshold, or that is declared at module scope or exported. It allows `catch (e)`, as the book does: "The name `e` is often used to denote the specific error that was raised in a `try` / `catch` block". It also allows `_`.
- **Threshold:** the book's example is `n` in a scope "two lines long", and it gives no maximum. **Owner sign-off:** 3 lines. That covers a one-line arrow or a three-line loop, and nothing longer.
- **Fix:** none. Choosing a name needs to know what the value means.

#### NAM-03 · Avoid disinformation: no container word in a name unless it is true

- **Chapter:** 4 Meaningful Names § Avoid Disinformation. **bookCTX:** chunk 8
- **Quote:** "Programmers must avoid leaving false clues that obscure the meaning of code. For example, do not refer to a grouping of accounts as an `accountList` unless it's actually a `List` ."
- **Class:** types.
- **Rule:** `no-container-in-name`. It reports a binding whose name ends in `List`, `Array`, `Map` or `Set` when its type is not that container: `List`/`Array` must be array-like, `Map` a `Map` or `ReadonlyMap`, `Set` a `Set` or `ReadonlySet`.
- **Fix:** none. The right name depends on what the grouping is.

#### NAM-04 · Make meaningful distinctions: no number-series names

- **Chapter:** 4 Meaningful Names § Make Meaningful Distinctions. **bookCTX:** chunk 8
- **Quote:** "Number-series naming ( `a1` , `a2` , ... `aN` ) is the opposite of intentional naming. Such names are not dis-informative, they are uninformative; they provide no clue to the author's intention."
- **Class:** syntax.
- **Rule:** `no-number-series-names`. It reports two or more bindings in one scope that share a stem and differ only by a trailing number (`list1`, `list2`). It allows one-letter stems, because the book accepts ordered coordinates: "it is not hard to keep the arguments of `distance(x1,y1,x2,y2)` in order" (chunk 13). It allows names where the digits are part of a term (`sha256`, `utf8`, `base64`) because they do not form a series.
- **Fix:** none. Choosing a name needs to know what the value means.

#### NAM-05 · Avoid names that differ only slightly

- **Chapter:** 4 Meaningful Names § Avoid Disinformation. **bookCTX:** chunk 8
- **Quote:** "Beware of using names that vary in small ways. How long does it take to spot the subtle difference between an `XYZControllerForEfficientHandlingOfStrings` in one module and, somewhere a little more distant, an `XYZControllerFor EfficientStorageOfStrings` ?"
- **Class:** not lintable. The book's example spans modules, and an ESLint or Oxlint rule sees one file. Within a file, edit distance also flags intended pairs such as `getItem` and `getItems`.

#### NAM-06 · Avoid `l` and `O` as names

- **Chapter:** 4 Meaningful Names § Avoid Disinformation. **bookCTX:** chunk 8
- **Quote:** "For example, be careful with the use of lowercase *L* and uppercase *O* . In certain fonts, they can be indistinguishable from the constants 1 and 0, respectively."
- **Class:** built-in.
- **Rule:** `id-denylist` with `l`, `O` and `I`. The book names `l` and `O`. `I` is added because it has the same problem with `l` and `1`. **Owner sign-off** for `I`.
- **Fix:** none (built-in).

#### NAM-07 · No arbitrary distinctions such as `klass`

- **Chapter:** 4 Meaningful Names § Make Meaningful Distinctions. **bookCTX:** chunk 8
- **Quote:** "It is not sufficient to add number series or noise words, even though the compiler is satisfied. If names must be different, then they should also mean something different."
- **Class:** built-in.
- **Rule:** `id-denylist` with `klass` and `clazz`, the misspellings the book's footnote names. It shares one `id-denylist` setting with NAM-06.
- **Fix:** none (built-in).

#### NAM-08 · No noise words in names

- **Chapter:** 4 Meaningful Names § Make Meaningful Distinctions. **bookCTX:** chunk 8
- **Quote:** "Noise words are redundant. The word *variable* should never appear in a variable name. The word *table* should never appear in a table name. How is `NameString` better than `Name` ?"
- **Class:** syntax.
- **Rule:** `no-noise-words`. It reports a variable, parameter or property whose name contains the word `variable`, or ends in `String` or `Object` when the declared type annotation is that type. Class names are covered by NAM-11 in the same rule. The word *table* is left out because the book means database tables, which have no syntax here.
- **Fix:** none. Removing the word can collide with another name, and choosing a different one needs the meaning.

#### NAM-09 · Avoid encodings: no member prefixes

- **Chapter:** 4 Meaningful Names § Member Prefixes. **bookCTX:** chunk 8
- **Quote:** "Prefixing member variables with something like `m_` is another form of type encoding that is no longer necessary. Your classes and functions should be small enough that you don't need such a crutch."
- **Class:** syntax.
- **Rule:** `no-encodings`. It reports names that start with `m_`, and the Hungarian prefixes `str` and `sz` followed by an uppercase letter (`strName`). It does not report a leading `_`: in TypeScript that marks an intentionally unused binding, which is a different convention.
- **Fix:** drops the prefix, lowercases the first letter of the rest (`strURL` becomes `url`, `m_count` becomes `count`), and renames every reference. It applies only in an ES module file, and only to:
  - a local variable, or
  - a parameter that is a plain identifier, or
  - a `#private` class member.
  
  It does not apply when:
  - any reference is a shorthand property (`{ m_count }`) or a destructuring key,
  - the binding is a function or a class, whose `name` property would change,
  - the new name is declared in, or referenced from (including as a global), any scope the binding is visible in.
  
  Imports, exports, TypeScript `private` members (which are ordinary properties at run time, seen by `JSON.stringify` and `Object.keys`), and declarations in script files or `declare` blocks are reported without a fix.

#### NAM-10 · No `I` prefix on interfaces

- **Chapter:** 4 Meaningful Names § Interfaces and Implementations. **bookCTX:** chunk 8
- **Quote:** "We do not recommend prefixing interfaces with `I` , because that's just another kind of type encoding."
- **Class:** syntax.
- **Rule:** `no-encodings` reports a TypeScript interface whose name is `I`, then an uppercase letter, then a lowercase letter (`IShape`). Acronyms such as `IPAddress`, `IOStream` and `IFrameProps` are not reported, because their second capital is followed by another capital.
- **Fix:** renames the interface and its references when it is declared in an ES module file, is not exported or imported, is not inside a `declare` block, and the new name is free in every scope it is visible in. Interfaces have no runtime form, and a non-exported one in a module cannot be named from another file, so the rename changes nothing else.

#### NAM-11 · No `Manager`, `Processor`, `Data` or `Info` in class names

- **Chapter:** 4 Meaningful Names § Use Appropriate Parts of Speech (Class Names). **bookCTX:** chunk 8
- **Quote:** "Avoid noise words like `Manager` , `Processor` , `Data` , or `Info` in the name of a class. We already know that classes manage and process data and info-you don't need to tell us."
- **Class:** syntax.
- **Rule:** `no-noise-words` reports a class whose name contains one of these four words as a separate camel-case word.
- **Fix:** none. Removing the word may leave a name that says nothing, or collide with another one.

#### NAM-12 · Predicates are named as questions and must not hide side effects

- **Chapter:** 4 Meaningful Names § Method Names; Appendix, The Clean Code Debate. **bookCTX:** chunks 8, 41
- **Quote (chunk 8):** "Depending on your language, accessors, mutators, and predicates should be named according to the local convention. In Java, they are named for their value and prefixed with `get` , `set` , and `is` according to the JavaBeans standard."
- **Quote (Appendix, chunk 41):** "If a reader trusts the name `isMultipleOfNthPrimeFactor` (which suggests a predicate with no side effects) and doesn't bother to read its code, they will not realize that it has side effects"
- **Class:** syntax, and types.
- **Rules:**
  - `no-side-effects-in-predicates` (syntax): reports a function or method named `is`, `has`, `can` or `should` followed by an uppercase letter, when its body assigns to anything declared outside it: `this.*`, a module or closure variable, or a property of a parameter.
  - `predicate-returns-boolean` (types): reports such a function whose return type is not `boolean` (or a promise of one).
- **Fix:** none. The book's remedy is to rename the function or separate the effect, and both need a choice of name.

#### NAM-13 · Use named static factory methods instead of overloaded constructors

- **Chapter:** 4 Meaningful Names § Method Names. **bookCTX:** chunk 8
- **Quote:** "When such constructors are overloaded, it is better to use static factory methods with names that describe the arguments."
- **Class:** syntax.
- **Rule:** `no-overloaded-constructors` reports a TypeScript class with more than one constructor overload signature.
- **Fix:** none. Each factory needs a name that describes its arguments.

#### NAM-14 · Pick one word per concept

- **Chapter:** 4 Meaningful Names § Pick One Word per Concept. **bookCTX:** chunk 9
- **Quote:** "Pick one word for one concept, and stick with it. For example, don't use `amount` in one module, `fee` in another, `price` in yet another, and `cost` in still another."
- **Class:** not lintable. Which words are synonyms in a given domain is not in the code, and the book's example spans modules, which a per-file linter cannot see.

#### NAM-15 · Use pronounceable names

- **Chapter:** 4 Meaningful Names § Use Pronounceable Names. **bookCTX:** chunk 8
- **Quote:** "It would be a shame not to take advantage of that huge portion of our brains that has evolved to deal with spoken language. So make your names pronounceable."
- **Class:** not lintable. A vowel or consonant-run heuristic flags common abbreviations (`src`, `ctx`, `fn`, `http`) that readers do pronounce, and it needs a dictionary per natural language.

#### NAM-16 · Function names are verbs; class names are nouns

- **Chapter:** 7 Clean Functions § Descriptive; 4 Meaningful Names § Use Appropriate Parts of Speech; 8 Function Heuristics § Conclusion. **bookCTX:** chunks 8, 12, 15
- **Quote (chunk 12):** "Every clean function should have a name that describes what that function does. Since the name describes behavior, the name should be a verb, a verb phrase, or an implicit verb, like `Math.sign(x)` ."
- **Class:** not lintable. The book accepts implicit verbs such as `average` and `sign`, and noun-style accessors in teams that use them, so part of speech cannot be read from the name alone.

#### NAM-17 · Don't be cute

- **Chapter:** 4 Meaningful Names § Don't Be Cute. **bookCTX:** chunk 9
- **Quote:** "If names are too clever, they will be memorable only to people who share the author's sense of humor, and only as long as these people remember the joke."
- **Class:** not lintable. Humour is not a syntax property.

#### NAM-18 · Use solution-domain and problem-domain names at the right level

- **Chapter:** 4 Meaningful Names § Use Problem Domain Names. **bookCTX:** chunk 9
- **Quote:** "The code that has more to do with problem domain concepts should have names drawn from the problem domain. We don't force solution domain names on the problem, nor problem domain names on the solutions."
- **Class:** not lintable. It needs the abstraction level of the code and the domain's vocabulary.

#### NAM-19 · Add meaningful context; don't add gratuitous context

- **Chapter:** 4 Meaningful Names § Add Meaningful Context, § Don't Add Gratuitous Context. **bookCTX:** chunk 9
- **Quote:** "In an imaginary application called Gas Station Deluxe, it is a bad idea to prefix every class with `GSD` . Frankly, you are working against your tools."
- **Class:** not lintable without project configuration. The prefix is project-specific. Projects that have one can ban it with `id-match`.

#### NAM-20 · Function and class name length inversely proportional to scope

- **Chapter:** 4 Meaningful Names § Function Names, § Class Names; 7 Clean Functions § Convenient. **bookCTX:** chunks 8, 12
- **Quote (chunk 8):** "Our rule for functions is exactly the opposite. The length of their names should be inversely proportional to the length of their scope. Thus, global functions will have short names, while private methods within a class will have relatively long names."
- **Class:** not lintable. The book gives no length, and "short" for an exported function depends on call frequency across the project ("A function that is called a lot should have a short and memorable name", chunk 12), which a per-file linter can't count.

#### NAM-21 · Rename as understanding improves

- **Chapter:** 4 Meaningful Names § Final Words. **bookCTX:** chunk 9
- **Quote:** "Since it's hard to get it right (even with these fine guidelines), we often have to iterate on our software names."
- **Class:** not lintable. This is a practice, not a property of the code.

#### NAM-22 · Prefer keyword (options) parameters for variations

- **Chapter:** 4 Meaningful Names § Consider Keyword Parameters; 8 Function Heuristics § Keyword Arguments. **bookCTX:** chunks 9, 13
- **Quote:** "If your language allows keyword or hash map parameters, such as Python, C#, Ruby, and Clojure do, you may find it best to limit the positional parameters of a function and use explicit keyword-only parameters for most variations."
- **Class:** syntax, through FH-01 and FN-04. The flag-argument fix (FH-01) turns a boolean variation into an options object, which is this entry's remedy in JavaScript. `max-params` (FN-04) limits positional parameters. No separate rule is needed.

### Chapter 5, Comments

#### CMT-01 · Comments compensate for failure to express yourself in code

- **Chapter:** 5 Comments § Compensating for Failure. **bookCTX:** chunk 9
- **Quote:** "The proper use of comments is to compensate for our failure to express ourselves in code. Note that I used the word *failure* . I meant it. Comments are always failures of either our languages or our abilities."
- **Class:** not lintable. This is the premise behind CMT-03 to CMT-12. The book also says "This doesn't mean that we never write comments", so a comment-density rule would go beyond it.

#### CMT-02 · Good comments: legal, informative, intent, clarification, warning, amplification, public API docs

- **Chapter:** 5 Comments § Good Comments and its subsections. **bookCTX:** chunk 9
- **Quote:** "If you are writing a public API, then you should certainly write good document comments for it. But keep in mind the rest of the advice in this chapter. Document comments can be just as misleading, nonlocal, and dishonest as any other kind of comment."
- **Class:** not lintable. Whether a comment informs, warns or amplifies is semantic. Requiring doc comments on every export would contradict CMT-04 (mandated comments). Every comment rule in this plugin is written so these kinds pass. Each rule's tests include a legal header, a regex explanation and a "why" comment.

#### CMT-03 · Redundant and noise comments that restate the code

- **Chapter:** 5 Comments § Redundant Comments, § Noise Comments, § Redundancy and Imprecision. **bookCTX:** chunk 10
- **Quote:** "Sometimes you see comments that are nothing but noise. They restate the obvious and provide no new information."
- **Class:** syntax.
- **Rule:** `no-redundant-comments`. It reports a doc comment (`/** */`) with no block tags (no `@…`) on a declaration, when every content word of the comment is a word of the declaration's name. The comparison ignores stop words (`the`, `a`, `an`, `this`, `of`, `for`, `to`) and the accessor verbs `returns`, `gets` and `sets`. For example:
  - `/** The processor delay for this component */` on `backgroundProcessorDelay` is not reported, because it has the word "component". The book calls this exact comment clutter. The rule misses it on purpose: once one comment word is outside the name, the rule cannot tell an obvious word from real information, and its fix deletes the comment.
  - `/** Returns the day of the month. */` on `getDayOfMonth` is reported.
  - "Default constructor." on a constructor is reported.
  
  A doc comment with any tag is not reported, because tags can change what tools do: `@internal` with `stripInternal`, a JSDoc `{type}` under `checkJs`, `@deprecated`, `@override`, `@template`, `@type` and `@satisfies`.
- **Fix:** deletes the comment, following [How fixes stay safe](#how-fixes-stay-safe).

#### CMT-04 · Mandated comments: `@param` tags that repeat the parameter name

- **Chapter:** 5 Comments § Mandated Comments. **bookCTX:** chunk 10
- **Quote:** "It is just plain silly to have a rule that says that every function must have a Javadoc, or every variable must have a comment. Comments like this just clutter up the code, propagate misinformation, and lend to general confusion and disorganization."
- **Class:** syntax.
- **Rule:** `no-redundant-comments` also reports a `@param` tag that has no `{type}` and whose description is empty or only the parameter's name split into words (`@param title The title`).
- **Fix:** deletes that tag line. If the doc comment then holds nothing, it deletes the whole comment, following [How fixes stay safe](#how-fixes-stay-safe). A `@param` with a `{type}` is never deleted: in a JavaScript file under `checkJs` it is the parameter's type.

#### CMT-05 · Function headers: prefer a good name to a header comment

- **Chapter:** 5 Comments § Function Headers. **bookCTX:** chunk 10
- **Quote:** "Short functions don't need much description. A well-chosen name and signature for a small function that does one thing is *usually* better than a comment header."
- **Class:** syntax, through CMT-03. A header comment that only restates the name is reported. A header that adds information is a good comment by CMT-02, and the book's own word is "*usually*".

#### CMT-06 · Journal comments: let version control keep the history

- **Chapter:** 5 Comments § Journal Comments. **bookCTX:** chunk 10
- **Quote:** "Nowadays, however, these long journals are just more clutter to obfuscate the module. They should be completely removed. Let the source code control system keep the journal for you."
- **Class:** syntax.
- **Rule:** `no-journal-comments`. It reports a comment in which the threshold number of lines start with a date (`2024-01-31`, `31-Jan-2024`, `1/31/2024`) followed by `:` or `-`, which makes it a change log.
- **Threshold:** the book gives no number. **Owner sign-off:** 3 dated lines. One or two dated lines are often a single "as of" note, not a journal.
- **Fix:** deletes those dated lines, and the whole comment when nothing else is left, following [How fixes stay safe](#how-fixes-stay-safe).

#### CMT-07 · Position markers (banners)

- **Chapter:** 5 Comments § Position Markers. **bookCTX:** chunk 10
- **Quote:** "There are rare times when it makes sense to gather certain functions together beneath a banner like this. But in general, they are clutter that should be avoided-especially the noisy train of slashes at the end."
- **Class:** syntax.
- **Rule:** `no-position-markers` reports a comment containing a run of one punctuation character (`/`, `*`, `-`, `=`, `#`) of the threshold length or more. These are not runs:
  - JSDoc's opening `/**`,
  - an arrow (a run followed by `>`, as in `[A] -----> [B]`),
  - a line in a doc comment made only of the run that directly underlines a line of text, which is a Markdown heading or table rule.
- **Threshold:** the book gives none. **Owner sign-off:** 5 characters, which is longer than any ordinary punctuation in prose.
- **Fix:** removes the run and the space around it. If the comment then has no text, it deletes the comment, following [How fixes stay safe](#how-fixes-stay-safe).

#### CMT-08 · Attributions and bylines

- **Chapter:** 5 Comments § Attributions and Bylines. **bookCTX:** chunk 10
- **Quote:** "Source code control systems are very good at remembering who added what, when. There is no need to pollute the code with little bylines."
- **Class:** syntax.
- **Rule:** `no-attribution-comments` reports `@author` tags, and `Added by`, `Created by` or `Modified by` followed by a person: one or more capitalised words, an email address, or an `@handle`, then the end of the line or a date. `// Created by Object.create(null), so it has no prototype` is not a byline.
- **Fix:** deletes a comment that is only a byline, following [How fixes stay safe](#how-fixes-stay-safe). When the comment has other text, it is reported without a fix, because deleting it would lose that text.
- **Not reported, for owner sign-off:** issue keys and pull request numbers. The book does say "Put those in commit comments, not in the source code", but a pattern like `ABC-123` also matches part numbers, standards (`ISO-8601`) and error codes.

#### CMT-09 · HTML in comments

- **Chapter:** 5 Comments § HTML Comments. **bookCTX:** chunk 10
- **Quote:** "If comments are going to be extracted by some tool (like Javadoc) to appear in a nicely formatted document, then it should be the responsibility of that tool, and not the programmer, to adorn the comments with appropriate formatting."
- **Class:** syntax.
- **Rule:** `no-html-in-comments` reports HTML formatting tags (`p`, `br`, `pre`, `code`, `b`, `i`, `em`, `strong`, `tt`, `ul`, `ol`, `li`) and HTML entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`, `&nbsp;`) in comments. Other angle-bracket text, such as a JSX example in a doc comment, is not reported.
- **Fix:** decodes the entities and removes the tags, keeping the text between them. It works one level at a time. `&amp;` followed by an entity name (`&amp;lt;`) is reported without a fix, so a second `--fix` pass cannot decode it again. There is no fix when removing a tag would join `*` and `/` into the end of the comment.

#### CMT-10 · Don't check in TODO comments

- **Chapter:** 5 Comments § TODO Comments. **bookCTX:** chunk 10
- **Quote:** "I still use `TODO` comments, but I will not check them in. I will either do the thing that needs to be done, or eliminate the reason that it needs to be done, or put it into the backlog of tasks that need to be performed."
- **Class:** built-in.
- **Rule:** `no-warning-comments` with terms `todo` and `fixme`. The book names TODO; FIXME is the same thing under another word. **Owner sign-off** for adding `fixme`.
- **Fix:** none. ESLint's rule has none. Deleting the comment would also drop the task the book says belongs in the backlog.

#### CMT-11 · Commented-out code

- **Chapter:** 5 Comments § Commented-Out Code. **bookCTX:** chunk 10
- **Quote:** "Few practices are as odious as commenting-out code. Commented-out code is an abomination before nature and nature's God. Don't check this stuff in!"
- **Class:** syntax.
- **Rule:** `no-commented-out-code`. It reports a comment, or a run of consecutive line comments, whose text parses as one or more JavaScript statements, when:
  - the first statement is not a labelled statement, so prose like `TODO: fix(this)` or `Note: call(x)` is never code, and
  - the text has code syntax: a semicolon, braces, a call or an assignment. That stops a single word or a short sentence from counting as an identifier expression.
  
  Doc comments, `@example` blocks and directive comments (see [How fixes stay safe](#how-fixes-stay-safe)) are not checked. A comment that `no-warning-comments` reports (a TODO or FIXME) is left to that rule.
- **Fix:** deletes the comment, following [How fixes stay safe](#how-fixes-stay-safe). Commented-out code is often a multi-line block, and the safe-edit rule for line breaks matters most here.

#### CMT-12 · Misleading, nonlocal, too-much-information, unobvious-connection, too-intimate comments

- **Chapter:** 5 Comments § Misleading Comments, § Nonlocal Information, § Too Much Information, § Unobvious Connection; § Comments That Are Too Intimate. **bookCTX:** chunks 9, 10
- **Quote:** "If you must write a comment, then make sure it describes the code it appears near. Don't offer systemwide information in the context of a local comment."
- **Class:** not lintable. Each of these compares what a comment says with what the code does, which needs understanding both.

#### CMT-13 · No doc comments in nonpublic code

- **Chapter:** 5 Comments § Javadocs in Nonpublic Code. **bookCTX:** chunk 10
- **Quote:** "As useful as Javadocs are for public APIs, they are more of an impediment than a benefit to code that is maintained by a small team and is not intended for public consumption."
- **Class:** not lintable. Whether code is "intended for public consumption" is a property of the project, not of the file. A non-exported function in a library's internals and an exported one in an application look the same. CMT-03 removes the doc comments that add nothing in either case.

#### CMT-14 · Replace a comment with a named function or variable

- **Chapter:** 5 Comments § Explain Your Intent in Code; 13 Clean Classes § Fixing the Problem. **bookCTX:** chunks 9, 21
- **Quote (chunk 21):** "Going forward, if you feel you need a comment to guide readers through a line or five of related code, consider extracting it into its own method. The "guiding" comment often provides the basis for the new method's name, as it does here."
- **Class:** not lintable as its own rule. A comment above a short block is also how the book's good comments look (CMT-02), so the comment alone does not show which kind it is. The checkable part is the complex condition the comment usually explains, which ONE-04 reports.

### Chapter 6, Formatting

#### FMT-01 · Keep source files small

- **Chapter:** 6 Formatting § Vertical Formatting. **bookCTX:** chunk 11
- **Quote:** "It appears to be possible to build significant systems (at the time of this analysis, FitNesse was close to 50,000 lines) out of files that are typically 200 lines long, with an upper limit of 500. Although this should not be a hard-and-fast rule, it should be considered very desirable."
- **Class:** built-in.
- **Rule:** `max-lines` with `max: 500`.
- **Threshold:** 500, the book's upper limit. Blank lines and comments are counted, because the book measures file length.
- **Fix:** none (built-in).

#### FMT-02 · Avoid protected variables

- **Chapter:** 6 Formatting § Vertical Distance. **bookCTX:** chunk 11
- **Quote:** "But then closely related concepts should not be separated into different files unless you have a very good reason. Indeed, this is one of the reasons that `protected` variables should be avoided."
- **Class:** syntax.
- **Rule:** `no-protected-fields` reports a TypeScript `protected` property declaration. Protected methods are not reported, because the book's reason is about variables.
- **Fix:** none. Making the field private breaks the subclasses that use it, and making it public widens access.

#### FMT-03 · Instance variables in one well-known place

- **Chapter:** 6 Formatting § Variable Declarations. **bookCTX:** chunk 11
- **Quote:** "The important thing is for the instance variables to be declared in one well-known place. Everybody should know where to go to see the declarations."
- **Class:** syntax.
- **Rule:** `fields-first` reports a class field declared after a method, accessor or constructor. Fields go first, which is the JavaScript and TypeScript convention.
- **Fix:** moves the fields above the first non-field member, keeping their order relative to each other. Field initializers run in the order the fields are declared, and methods live on the prototype, so the move changes nothing at runtime. There is no fix when the class has any of these, because each runs in source order and the move would change that order:
  - a moved field with a computed key (`[k()] = 1`), because its key is evaluated when the class is defined, in source order with the other computed keys. A computed key elsewhere, such as `[Symbol.iterator]() {}`, does not block the fix: a field with a plain key has nothing to evaluate when the class is defined, so moving it past a computed method changes no order.
  - a decorator on any member,
  - a `static {}` block,
  - an auto-accessor (`accessor x`), whose storage is initialised in order with the fields,
  - a field initializer that refers to the class.
  
  The move follows [How fixes stay safe](#how-fixes-stay-safe). A moved field without a `;` gets one when the next member would otherwise continue it (`size = 0` followed by `[Symbol.iterator]() {}`).

#### FMT-04 · Dependent functions: caller above callee (the Stepdown Rule)

- **Chapter:** 6 Formatting § Dependent Functions; 7 Clean Functions § Reading Code from Top to Bottom: The Stepdown Rule; 10 One Thing § 4. Bouncing Around. **bookCTX:** chunks 11, 12, 17
- **Quote (chunk 17):** "I like to organize my extracted functions in the order that they are called. So, when one function calls another, all you have to do is scroll down to see the called function-right there. If function A calls B and C, then their order in the source file should be A, B, C."
- **Class:** syntax.
- **Rule:** `stepdown-order`. It reports a function declaration, or a class method, that is declared above the first function or method in the same scope that calls it. It checks only function declarations and methods, which are bound before any code in their scope runs. A `const f = () => …` is never checked: moving it below its caller can put a call inside its temporal dead zone. Recursion and mutual recursion are ignored.
- **Fix:** moves the reported function declaration to just after its first caller, with the comments attached to it. A TypeScript overload group (signatures and implementation) moves as one block. The fix applies only when:
  - the file is an ES module or strict-mode code, and the declaration sits directly in a function body or the module body. In sloppy-mode code, a function declared in a block is bound at the point it is evaluated, so moving it changes what runs.
  - no other declaration in the scope has the same name, since the last one wins.
  - the function has no decorators.
  
  The move follows [How fixes stay safe](#how-fixes-stay-safe). Class methods are reported without a fix: moving a method changes the order of `Object.getOwnPropertyNames(C.prototype)`, which code can observe, and a computed method key is evaluated in source order.
- **Note:** this ordering conflicts with core `no-use-before-define` unless that rule runs with `functions: false`. The README will say so.

#### FMT-05 · Declare loop control variables in the loop

- **Chapter:** 6 Formatting § Variable Declarations. **bookCTX:** chunk 11
- **Quote:** "Variables should be declared as close to their usage as possible. Because our functions are very short, local variables should appear at the top of each function, as in this longish function from JUnit 4.3.1."
- **Class:** syntax.
- **Rule:** `loop-variable-in-loop` reports `let i; for (i = 0; …)` when `i` is not read after the loop. The book's sentence after the quote is: "Control variables for loops should usually be declared within the loop statement".
- **Fix:** moves the declaration into the loop header. It applies only when:
  - every reference to `i` is inside the `for` statement, header or body, and none is inside a nested function or class. A `let` in the loop header creates a new binding each iteration, so a closure would see a different value.
  - the declaration declares only `i`, has no initializer, and comes directly before the loop.
  - the loop's init assigns only `i`.
  
  The removed declaration follows [How fixes stay safe](#how-fixes-stay-safe).

#### FMT-06 · Vertical openness, density and conceptual affinity

- **Chapter:** 6 Formatting § Vertical Openness between Concepts, § Vertical Density, § Conceptual Affinity. **bookCTX:** chunk 11
- **Quote:** "Each line represents an expression or a clause, and each group of lines represents a complete thought. Those thoughts should be separated from each other with blank lines."
- **Class:** not lintable by this plugin. Blank lines and grouping are layout, which the book says a team should "agree upon" and apply with one tool (FMT-08). Core ESLint's layout rules are deprecated in favour of a formatter, and both ESLint and Oxlint expect projects to run one.

#### FMT-07 · Keep lines short (120)

- **Chapter:** 6 Formatting § Horizontal Formatting. **bookCTX:** chunk 11
- **Quote:** "The old Hollerith limit of 80 is a bit arbitrary, and I'm not opposed to lines edging out to 100 or even 120. But beyond that is probably just careless."
- **Class:** not lintable by this plugin, for the same reason as FMT-06. Line length is the formatter's print width. The README will tell projects to set it to 120, the book's value.

#### FMT-08 · One formatting style, agreed by the team and applied consistently

- **Chapter:** 6 Formatting § Formatting, § Team Rules. **bookCTX:** chunk 11
- **Quote:** "You should take care that your code is nicely formatted. You should choose a set of simple rules that govern the format of your code, and then you should consistently apply those rules."
- **Class:** not lintable by this plugin. A formatter (Prettier, dprint, `oxfmt`, `@stylistic`) does this. It covers horizontal whitespace, alignment, indentation and collapsed scopes too (Formatting § Horizontal Openness and Density, § Horizontal Alignment, § Indentation, § Breaking Indentation).

### Chapter 7, Clean Functions

#### FN-01 · Functions should be very small

- **Chapter:** 7 Clean Functions § Small!. **bookCTX:** chunk 12
- **Quote:** "As I matured, I wrote functions that were 20 to 30 lines long. And in the last two decades, I've shortened that to a dozen lines or less. What those decades have taught me, through long trial and error, is that functions should be very small."
- **Class:** built-in.
- **Rule:** `max-lines-per-function` with `max: 12`, `skipBlankLines: true`, `skipComments: true`.
- **Threshold:** 12, the book's "a dozen lines or less". The book gives other numbers, and the owner may prefer one of them:
  - "That number might be three, or four, or six." (10 One Thing § Extract Method Refactoring, chunk 17)
  - "Perhaps you are more comfortable with 20-line functions or 25-line functions. That's up to you." (10 One Thing § Conclusion, chunk 19)
  - The Appendix debate quotes the first edition's "hardly ever be 20 lines long" (chunk 40).

  The author's own stated practice is "a dozen lines or less", so that is the value used. Blank lines and comments are skipped so the rule measures code. **Owner sign-off** on 12 over 20 or 25.
- **Fix:** none (built-in).
- **Caveat the doc will carry:** "This is not a hard-and-fast rule, and it can be overdone. There are certain functions that read better if they are not decomposed into smaller four-line functions. But these are exceptional cases." (7 Clean Functions § Well-Written Prose, chunk 12)

#### FN-02 · Do one thing (complexity)

- **Chapter:** 10 One Thing § Extract Method Refactoring; 19 The SOLID Principles § SRP. **bookCTX:** chunks 17, 26
- **Quote (chunk 26):** "It is true that a *function* should do one, and only one, thing. We use that principle when we are refactoring large functions into smaller functions. We use that principle at the lowest levels. But it is not one of the SOLID principles."
- **Class:** built-in.
- **Rule:** `complexity` with `max: 15`.
- **Threshold:** the book states no number for decision points. **Owner sign-off:** 15, which is stricter than ESLint's default of 20 and equals the limit the projects adopting this plugin use today, so switching loses no check. With FN-01's 12 lines and FN-03's depth of 2, a function rarely gets near 15.
- **Firing on a discriminated union, for owner sign-off:** an exhaustive `switch` over a union of 15 or more members is reported by this rule. A switch of about five or more cases is reported by FN-01. The book's answer for a large switch is that it "might be larger for certain `switch` statements" (FN-01's chunk 17), which a line or decision count cannot see. Projects that switch over large unions turn these limits down for those files.
- **Fix:** none (built-in).

#### FN-03 · Indent level of one or two

- **Chapter:** 7 Clean Functions § Well-Written Prose. **bookCTX:** chunk 12
- **Quote:** "This also implies that small functions will not be large enough to hold deeply nested structures. The indent level of a function will seldom be greater than one or two. This, of course, makes the functions easier to read and understand."
- **Class:** built-in.
- **Rule:** `max-depth` with `max: 2`.
- **Threshold:** 2, the book's "one or two". **Interpretation, for owner sign-off:** `max-depth` counts blocks nested inside the function body, so depth 2 allows an `if` inside a loop and nothing deeper. The book's word "seldom" is the reason not to choose 1.
- **Fix:** none (built-in).

#### FN-04 · Limit function arguments to three

- **Chapter:** 8 Function Heuristics § Function Arguments, § More Than Three?. **bookCTX:** chunk 13
- **Quote:** "Arguments are couplings and are therefore hard enough as it is without having to worry about their order in the calling sequence. What's more, they are harder to read than they are to write. The IDE will give you a lot of help while writing, but much less while reading. So three is usually my limit."
- **Class:** built-in.
- **Rule:** core `max-params` with `{ max: 3, countThis: "never" }` for every file type. The book does not count the implied receiver: "I am not counting the implied enclosing scope". `countThis: "never"` leaves a TypeScript `this` parameter out of the count. ESLint 10 and Oxlint 1.92 both support it.
- **Threshold:** 3, the book's value.
- **Fix:** none (built-in).
- **Note:** a destructured options object counts as one parameter, which is the book's remedy: "once you pass more than three, you have to ask yourself why you aren't passing in an object or data structure that encapsulates them."

#### FN-05 · Blocks inside `if`, `else` and `while` are one or two lines

- **Chapter:** 7 Clean Functions § Well-Written Prose; 10 One Thing § Extract Method Refactoring. **bookCTX:** chunks 12, 17
- **Quote:** "Keeping functions very small implies that the blocks within `if` statements, `else` statements, `while` statements, and so on will be only one or two lines long. Often that block will contain a call to another function."
- **Class:** syntax.
- **Rule:** `max-block-statements` reports a body with more statements than the threshold. It checks the bodies of `if`, `else`, `for`, `for…in`, `for…of`, `while` and `do`, and the `try`, `catch` and `finally` blocks (FH-06). A nested block statement counts as one, and its own body is checked separately.
- **Threshold:** 2, the book's "one or two lines", **interpreted** as statements instead of lines, so that a formatter's line wrapping does not change the result.
- **Fix:** none. The remedy is to extract the block into a named function, and the name has to describe what the block means.

#### FN-06 · One level of abstraction per function

- **Chapter:** 7 Clean Functions § One Level of Abstraction per Function, § Homogenous; 11 Be Polite § The Stepdown Rule: Once Again. **bookCTX:** chunks 12, 13, 19
- **Quote (chunk 19):** "Each function has a name that defines what the function does, and each function consists of a set of lines that describe the implementation and that are all at the same level of abstraction."
- **Class:** not lintable. Abstraction level is relative to the domain. The book also says: "How do you determine how big one level of abstraction is? All I can say to that is to use your best judgment."

#### FN-07 · Clean functions are nameable, insulated, homogenous, contextual and pure

- **Chapter:** 7 Clean Functions § Clean Functions: A Deeper Look, § Pure, § Partial Purity. **bookCTX:** chunks 12, 13
- **Quote:** "The behavior of a pure function is dependent upon nothing other than its arguments; and its execution does not cause the behavior of any other function to change."
- **Class:** not lintable as a whole. The book defines purity from outside the function ("purity is an external characteristic of a function, not an internal characteristic"), so local mutation is allowed, and a rule banning `let` would go past the book. The checkable parts are FH-03 (output arguments) and NAM-12 (hidden side effects in predicates).

#### FN-08 · Switch statements: once, in a factory, behind an interface

- **Chapter:** 7 Clean Functions § Switch Statements. **bookCTX:** chunk 12
- **Quote:** "My general rule for `switch` statements is that they can be tolerated if they appear only once, are positioned in a concrete module like `main` , are used to create polymorphic objects, and are hidden behind an interface so that the rest of the system can't see them."
- **Class:** syntax, through OBJ-05, which states the same rule with its threshold.

### Chapter 8, Function Heuristics

#### FH-01 · Avoid boolean flag arguments

- **Chapter:** 8 Function Heuristics § Flag Arguments. **bookCTX:** chunk 13
- **Quote:** "Flag arguments are ugly. Passing a `boolean` into a function is generally careless. It immediately complicates the signature of the function, and loudly proclaims that the function does more than one thing."
- **Class:** syntax.
- **Rule:** `no-flag-argument` reports a function or method parameter declared with a `boolean` type annotation or a boolean default value (`= false`). It does not report:
  - the book's exception, a method named `set` followed by an uppercase letter, whose last parameter is the boolean: "some objects have binary flags within them that are set with a `setFlag(boolean)` method. I'm not going to complain about them."
  - a `set` accessor, which is called by assignment.
  - a method that returns `this` (a fluent setter).
  - a function written directly as a call argument or JSX attribute (`onToggle={(open: boolean) => …}`), and a method with the `override` modifier or in a class that `implements` an interface. Their signatures are set by someone else.
  - a parameter that is already a destructured options object, whose booleans are named at the call site.
- **Fix:** turns the boolean parameter into a property of an options object, which is the keyword-parameter remedy (NAM-22). `(name, verbose = false)` becomes `(name, { verbose = false } = {})`. `(name, verbose?: boolean)` becomes `(name, { verbose }: { verbose?: boolean } = {})`: a call that leaves the argument out still gets `undefined`. A required `(name, verbose: boolean)` becomes `(name, { verbose }: { verbose: boolean })`, so the body still sees a `boolean`; it is fixed only when every call passes the argument, since a call that leaves it out would then throw. Each call `f(x, true)` becomes `f(x, { verbose: true })`, and the overload signatures of `f` are rewritten in the same fix. The fix applies only when all of these hold:
  - `f` is a function declaration or a `const` function in an ES module file, not a method, and not exported.
  - The boolean is the last parameter.
  - `f` does not use `arguments`.
  - Every reference to `f` is a direct call in the same file, with no spread argument and no `new`.
  - No other declaration in the scope has the name `f`, and the file has no direct `eval`.
  - The file has an `import` or `export`, so it is an ES module by its syntax as well as its configuration.
  
  A method is reported without a fix, because an override in another file would still receive a boolean. An exported function, or one passed as a value, is reported without a fix too.
- **Deviation from an acceptance line, for owner sign-off:** the ticket says that after `--fix` the code "no longer triggers the rule". That holds for every case the fix applies to. A method, an exported function and a function passed as a value are still reported after `--fix`, because no fix can see their callers in other files.
- **Tests the build must include (ticket acceptance):** for each fix, the output before and after, a run of both versions on the same inputs showing equal results, and a lint of the output showing no report.
- **The book's own remedy** is to split the function in two (`getLongMonthNames()`, `getShortMonthNames()`). That needs two new names, so the rule's message suggests it and the fix uses the options object instead.

#### FH-02 · Avoid output arguments

- **Chapter:** 8 Function Heuristics § Output Arguments. **bookCTX:** chunk 13
- **Quote:** "Arguments are most naturally interpreted as inputs to a function. But sometimes people will use arguments to catch *output* values. This is often because they want to return more than one value from a function."
- **Class:** built-in, through FH-03, for writes to a parameter (`out.total = x`). Mutating method calls on a parameter (`out.push(x)`, `map.set(k, v)`) are not lintable from syntax: whether a method mutates its receiver depends on the receiver's type and the method's body, and a list of method names would report non-mutating calls of the same name.

#### FH-03 · Don't write to parameters

- **Chapter:** 8 Function Heuristics § Output Arguments; § Functional Languages. **bookCTX:** chunks 13, 14
- **Quote (chunk 14):** "Why would functional languages prevent overwriting values? Because overwriting is a side effect. It separates the lines above it and the lines below it by a change of state. It creates a temporal coupling. The order matters."
- **Class:** built-in.
- **Rule:** `no-param-reassign` with `props: true` and `ignorePropertyModificationsFor: ["acc", "accumulator"]`. That reports reassigning a parameter and writing to a parameter's properties, which is the output-argument pattern.
- **Exemption, for owner sign-off:** the two names exempt a `reduce` accumulator (`(acc, x) => { acc[x.id] = x; return acc }`). The callback creates nothing the caller passed in, so it is not an output argument.
- **Firing on a getOrCreate, for owner sign-off:** a free function that writes into a cache passed to it, `getOrCreate(cache, key, make) { cache[key] ??= make(); … }`, is reported. That is an output argument in the book's sense: the caller's object is changed through a parameter. A getOrCreate written as a method on the object that owns the cache (`this.cache`) is not reported. The same holds for a free-function fluent setter (`withName(b, n) { b.name = n; return b }`), which is reported, and a method one (`setName(n) { this.name = n; return this }`), which is not.
- **Fix:** none (built-in).
- Reading a parameter object's properties (`opts.name`, `opts.limits.max`) is not a write, so it is not reported. A regression test covers it.

#### FH-04 · Command Query Separation

- **Chapter:** 8 Function Heuristics § Command Query Separation; § Caveat Emptor. **bookCTX:** chunks 13, 14
- **Quote (chunk 13):** "Under the CQS convention, functions either do something or answer something, but not both. Either a function is a command that creates a side effect (i.e., it changes the state of the system), or it is a query that returns some information."
- **Class:** syntax, and types for method calls on other objects. It is scoped narrowly to the book's own example (`if (set("username", "unclebob"))`).
- **Rule:** `no-command-query-mix`. It reports a call used as the test of an `if`, `while` or ternary when the callee both assigns to state outside itself and returns a boolean literal or comparison on some path. Without type information it checks only calls whose callee it can find from syntax: a function declared in the same file, or `this.method()` for a method of the enclosing class. In `recommended-type-checked`, the option `checkMethodCalls: true` also resolves `obj.method()` through the type of `obj`. Matching by name alone would confuse a project method `set()` with `Map.prototype.set`.
- **Not reported:** getters, fluent setters (which return `this`), a getOrCreate (which returns the value, not a boolean), and library calls such as `Map.prototype.delete` and `Set.prototype.add`, whose bodies the rule cannot see.
- **Fix:** none. Splitting the function into a query and a command needs two names. The book also treats CQS as a convention it breaks "only after considering the possible outcomes", for example an atomic `pop`.

#### FH-05 · Prefer exceptions to returning error codes

- **Chapter:** 8 Function Heuristics § Prefer Exceptions to Returning Error Codes, § Caveat Emptor. **bookCTX:** chunk 14
- **Quote:** "In general, I prefer exceptions to error codes where possible. Returning error codes from command functions is a subtle violation of command query separation. It promotes commands being used as expressions in the predicates of `if` statements."
- **Class:** not lintable. An error code looks like any other return value. `return -1` is also how a sort comparator answers, which the audit found `@george2f/eslint-plugin-clean-code`'s rule reporting. The checkable part, a command used as an `if` test, is FH-04.

#### FH-06 · Extract `try` and `catch` bodies into their own functions

- **Chapter:** 8 Function Heuristics § Extract Try/Catch Blocks. **bookCTX:** chunk 14
- **Quote:** "`Try/catch` blocks are ugly in their own right. They confuse the structure of the code and mix error processing with normal processing. So it is better to extract the bodies of the `try` and `catch` blocks out into functions of their own."
- **Class:** syntax, through FN-05's block limit applied to `try`, `catch` and `finally` blocks. `max-block-statements` counts their statements the same way.

#### FH-07 · Error handling is one thing

- **Chapter:** 8 Function Heuristics § Error Handling Is One Thing. **bookCTX:** chunk 14
- **Quote:** "This implies (as in the example above) that if the keyword `try` exists in a function, it should be the very first word in the function (after, perhaps, some variable declarations) and that there should be nothing after the `catch` / `finally` blocks."
- **Class:** syntax.
- **Rule:** `error-handling-is-one-thing`. In a function body that contains a `try` statement at its top level, it reports any statement before the `try` that is not a variable declaration, and any statement after it. It also reports a `try` nested in a `catch` clause. The book's "Noise Comments" example is a `try` inside a `catch`, and its fix is "improving the structure of his code" (chunk 10).
- **Fix:** none. The remedy is to extract the `try` into its own function. A `return`, `break`, `continue`, `await` or `yield` inside the `try` would change meaning when moved into a new function, and the new function needs a name.

#### FH-08 · No empty catch

- **Chapter:** 5 Comments § Mumbling. **bookCTX:** chunk 10
- **Quote:** "Plopping in a comment just because you feel you should, or because the process requires, it is a hack. If you decide to write a comment, then spend the time necessary to make sure it is the best comment you can write."
- **Class:** built-in.
- **Rule:** `no-empty` with `allowEmptyCatch: false`. A `catch` block that holds only a comment is allowed, as the book allows: in Noise Comments, a comment explaining why a catch is ignored "seems appropriate".
- **Fix:** none (built-in).

#### FH-09 · DRY: extract real duplication

- **Chapter:** 8 Function Heuristics § DRY: Don't Repeat Yourself, § Simple Repeated Code, § Similar Code, § Loop Duplication; 18 Simple Design § Minimize Duplication. **bookCTX:** chunks 14, 25
- **Quote (chunk 14):** "So, if *P* is large, even if *L* is small, it is probably best to extract the duplication into a single, nicely named function."
- **Class:** not lintable by this plugin. Clone detection needs to compare code across files, which neither linter's per-file rule API offers. Within one file, the book separates real from accidental duplication by intent (FH-10), which syntax cannot show. The book's table of L and P values is missing from the bookCTX text (probably an image), so no threshold could be taken from it.

#### FH-10 · Accidental duplication should be left alone

- **Chapter:** 8 Function Heuristics § Accidental versus Essential Duplication; 18 Simple Design § Accidental Duplication. **bookCTX:** chunks 14, 25
- **Quote (chunk 25):** "Accidental duplicates should not be eliminated. The duplication should be allowed to persist. As the requirements change, the duplicates will evolve separately and the accidental duplication will dissolve."
- **Class:** not lintable. Whether two copies serve the same actor is not in the code. This entry is the reason FH-09 has no rule.

#### FH-11 · Side effects create temporal coupling; paired operations

- **Chapter:** 8 Function Heuristics § Side Effects, § Object-Oriented Languages. **bookCTX:** chunk 14
- **Quote:** "Side effects create complications for software systems because they introduce an insidious form of coupling called *temporal coupling* -coupling in time. A statement with a side effect separates the code above it from the code below it with a change of state."
- **Class:** not lintable. Which calls form an open/close pair is library-specific. A name-based list (`open`, `lock`, `acquire`) would report pairs closed in another function on purpose, which is the book's own partial-purity pattern (7 Clean Functions § Partial Purity, chunk 13).

#### FH-12 · Structured programming: no unstructured jumps

- **Chapter:** 8 Function Heuristics § Structured Programming; 30 Repeatable Proof § Structured Programming; Appendix, The Clean Code Debate. **bookCTX:** chunks 15, 37, 43
- **Quote (chunk 37):** "`GOTO` is considered harmful because a `GOTO` statement can jump into or out of the middle of an enumerated sequence. `GOTO` s make enumeration intractable, making it impractical to prove an algorithm correct by enumeration or induction."
- **Class:** built-in.
- **Rule:** `no-labels`. A labelled `break` or `continue` is JavaScript's nearest thing to a jump into or out of the middle of a sequence. In the Appendix, Martin removes "the horrible `continue`" from his own code by restructuring it. Plain `continue` is not banned, because the book's case is the labelled one. The text applies single entry and exit to enumerated statements and does not ban early `return`, so this plugin has no single-return rule.
- **Fix:** none (built-in).

### Chapter 9, The Clean Method; Chapter 10, One Thing; Chapter 11, Be Polite

#### ONE-01 · A function does one thing when nothing more can be meaningfully extracted

- **Chapter:** 10 One Thing § Extract Method Refactoring; Appendix. **bookCTX:** chunks 17, 41
- **Quote (chunk 17):** "If you can split one function into two, then the original function did two things. So, a function that does one thing is a function from which you cannot extract another."
- **Class:** not lintable. What is "meaningful" is left to the reader: "I'll leave the rest of the interpretation of the word *meaningful* up to you." FN-01, FN-02, FN-03 and FN-05 are the measurable proxies.

#### ONE-02 · No pure-delegator extractions

- **Chapter:** 10 One Thing § Extract Method Refactoring; Appendix, The Clean Code Debate. **bookCTX:** chunks 17, 41
- **Quote:** "There is no point in extracting the entire body of a function, leaving behind a pure delegator. Such an extraction is not meaningful."
- **Class:** syntax.
- **Rule:** `no-pure-delegator`. It reports a non-exported function declaration whose whole body is `return g(p1, …, pn)` or `g(p1, …, pn);`, passing its own parameters unchanged and in order, where `g` is a function declared in the same file. A method is not reported: a method that forwards a request is how an object hides its collaborator ("Tell the Other Guy", OBJ-07). An exported function is not reported either, because the book's footnote allows a delegator "so that you can move the extracted function to a new module".
- **Fix:** replaces each call of the delegator with a call of `g`, and removes the delegator. It applies only when all of these hold:
  - The delegator is a plain function. It is not `async` and not a generator, since the result type would change.
  - Its parameters are plain identifiers, with no defaults, no destructuring and no rest parameter.
  - Every reference is a direct call that passes exactly as many arguments as the delegator declares, with no spread. A call with fewer or more arguments would change what `g` sees in `arguments` or a rest parameter.
  - No reference uses `new` or a tagged template.
  - The delegator does not use `this` or `arguments`.
  - `g` is visible and means the same binding at each call site.
  - A delegator without `return` is replaced only where its call is a statement, so its `undefined` result is not used.
  
  The removal follows [How fixes stay safe](#how-fixes-stay-safe).

#### ONE-03 · Large functions hide classes

- **Chapter:** 10 One Thing § What Are Large Functions Anyway?. **bookCTX:** chunk 18
- **Quote:** "Because every large function has a set of local variables and a set of indented regions that manipulate those variables. Those variables should really be fields of a class, and those indented regions should be methods of that class."
- **Class:** not lintable as a separate rule. A function large enough to show this pattern is already reported by FN-01, and whether the locals form a class is a design choice.

#### ONE-04 · Extract complex predicates into named functions

- **Chapter:** 10 One Thing § Extract Method Refactoring; 13 Clean Classes § Fixing the Problem. **bookCTX:** chunks 17, 21
- **Quote (chunk 21):** "Often the conditionals that control these pathways are complex, depending on combinations of method calls and variables- `if (x(a) && y || !z(c, d)` , for example. Those details don't make it clear why we're heading into a certain piece of code. An extracted predicate's method name can impart immediate understanding."
- **Class:** syntax.
- **Rule:** `no-complex-condition` reports the test of an `if`, `while`, `do…while` or ternary when it mixes `&&` and `||`, or joins more than the threshold of operands.
- **Threshold:** the book gives an example but no number. **Owner sign-off:** a mix of `&&` and `||` (the book's example), or more than 3 operands of one operator. `a && b && c` passes, and `a && b && c && d` is reported.
- **Fix:** none. The remedy is a named predicate, and the name has to say what the condition means. Hoisting the test into a `const` would also change when it is evaluated in a `while` loop and in an `else if`.

#### ONE-05 · Extracted functions may share state through the enclosing scope, but not through statics

- **Chapter:** 10 One Thing § Extraction and Classes. **bookCTX:** chunk 19
- **Quote:** "The bottom line is that sometimes when we extract functions, it is convenient and clean to allow those functions to communicate through variables in the scope (the class) that contains them."
- **Class:** syntax.
- **Rule:** `no-mutable-static-state` reports a `static` class field that is assigned to inside a method. The book's caveat is the reason: "Those static variables could get corrupted in a multithreaded environment. This is easy enough to correct by changing all the functions and variables from `static` to instance methods and variables."
- **Fix:** none. Turning static members into instance members changes every caller (`Class.member` becomes `instance.member`) and how many copies of the state exist.

#### ONE-06 · Order a module like a newspaper article

- **Chapter:** 11 Be Polite § The Newspaper Metaphor. **bookCTX:** chunk 19
- **Quote:** "The module's name should be simple but explanatory. The name, by itself, should be sufficient to tell us whether we are in the right module or not. The topmost parts of the module should provide the high-level concepts and algorithms."
- **Class:** syntax, through FMT-04. A caller-above-callee order puts the entry points at the top.

#### ONE-07 · Narrow public interface, deep private implementation

- **Chapter:** 11 Be Polite (chapter introduction). **bookCTX:** chunk 19
- **Quote:** "The public functions, possibly organized into public classes, represent the interface of your module. The private functions, also possibly organized into private classes, represent the implementation of your module."
- **Class:** not lintable. How many exports a module should have depends on what it is for. A ratio of exports to non-exports has no basis in the book.

#### ONE-08 · Code is done when it reads well

- **Chapter:** 11 Be Polite § This Is How We Write, but Not How We Want to Read. **bookCTX:** chunk 19
- **Quote:** "You are not done when the code works. You are done when the code reads well. You are done when you have extracted and organized and laid out the tree of functions descending from the public functions in a manner convenient to the reader."
- **Class:** not lintable. This is the goal the size and ordering rules serve.

#### ONE-09 · Replace growing `if`/`else` chains of numbers with a table

- **Chapter:** 9 The Clean Method § Example, § Conclusion. **bookCTX:** chunks 16, 17
- **Quote (chunk 16):** "This is pretty awful. I expect all those numbers to change over time. I even expect the number of rows in the table to change. Maintaining this is going to be labor intensive and error prone. We can probably do better."
- **Class:** not lintable as its own rule. The book's reason is that the numbers "change over time", which the code doesn't show. A long chain is already reported by FN-02 (`complexity`) and FN-01.

### Chapter 12, Objects and Data Structures

#### OBJ-01 · The Law of Demeter

- **Chapter:** 12 Objects and Data Structures § The Law of Demeter. **bookCTX:** chunk 20
- **Quote:** "The method should not invoke methods on objects that are returned by any of the allowed functions. In other words, be shy, talk to friends, and don't talk to strangers."
- **Class:** types.
- **Rule:** `law-of-demeter`. It reports a method call on the result of another method call (`a.b().c()`) when the intermediate result's type is an *object* in the book's sense: a class instance that has methods and non-public state. It does not report:
  - data structures: interfaces, type aliases, and classes with only public fields. The book says Demeter does not apply to them: "if `ctxt` , `Options` , and `ScratchDir` are just data structures with no behavior, then they naturally expose their internal structure, and so Demeter does not apply."
  - fluent APIs, where `b()` returns the same type as `a`.
  - types from the TypeScript standard library and `node_modules` (`Promise`, `Array`, `string`, builders).
  - property access of any kind, which is how parameter objects are read.
- **Threshold:** the book's four allowed targets, as listed: "*C*", "An object created by *f*", "An object passed as an argument to *f*", "An object held in an instance variable of *C*".
- **Firing on a getOrCreate caller, for owner sign-off:** `registry.getOrCreate(key).add(item)` is reported when what `getOrCreate` returns is an object. That object was not created by the calling method, passed to it, or held in its fields, so by the book's list it is a stranger. The `getOrCreate` function itself is never reported. This rule is in `recommended-type-checked` only.
- **Fix:** none. The book's remedy, "Tell the Other Guy", moves behaviour into another class.

#### OBJ-02 · Avoid trainwreck getter chains

- **Chapter:** 12 Objects and Data Structures § Trainwrecks. **bookCTX:** chunk 20
- **Quote:** "This kind of code is often called a *trainwreck* because it look like a bunch of coupled train cars. Chains of calls like this are generally considered to be sloppy style and should be avoided."
- **Class:** syntax.
- **Rule:** `no-getter-chains` reports a getter call made on the result of another getter call (`ctxt.getOptions().getScratchDir()`), which is the book's example. A getter call here means a method named `get` followed by an uppercase letter, called with no arguments. `getOrCreate(key)`, `getOrDefault(k, d)` and anything named `getOr…` are not getters, and neither is a call with arguments. That keeps `registry.getOrCreate(key).getName()` and `document.getSelection().getRangeAt(0)` out. Field access (`ctxt.options.scratchDir.absolutePath`) is not reported, as the book allows.
- **Threshold:** the book's example chains three calls and gives no limit. **Owner sign-off:** report from two chained getter calls.
- **Fix:** none. Splitting the chain into temporaries does not remove the coupling. The book also says: "Whether this is a violation of Demeter depends on whether or not `ctxt` , `Options` , and `ScratchDir` are objects or data structures."

#### OBJ-03 · Getters and setters do not hide implementation

- **Chapter:** 12 Objects and Data Structures § Data Abstraction; § Data Transfer Objects. **bookCTX:** chunks 19, 20
- **Quote (chunk 19):** "Hiding implementation is not just a matter of putting a layer of functions between the variables. Hiding implementation is about abstractions! A class does not simply push its variables out through getters and setters."
- **Class:** syntax.
- **Rule:** `no-trivial-accessors` reports a class in which every private field (TypeScript `private`, or `#private`) has a trivial getter (`return this.x`) and the class has no other methods. That is a data structure in disguise. The book's verdict on such classes: "The `Address` DTO might as well have public fields." (chunk 20)
- **Fix:** none. Replacing accessors with public fields changes how the property is defined (an accessor on the prototype becomes an own data property). That shows through `Object.keys`, spreading, JSON serialisation and `Object.defineProperty`.

#### OBJ-04 · Avoid hybrids

- **Chapter:** 12 Objects and Data Structures § Hybrids, § Trainwrecks. **bookCTX:** chunk 20
- **Quote:** "Such hybrids make it hard to add new functions but also make it hard to add new data structures. They are the worst of both worlds. Avoid creating them."
- **Class:** syntax.
- **Rule:** `no-hybrid-class` reports a class that has a public mutable field and a method with behaviour. A public mutable field is a field declaration, or a `this.x =` assignment in the constructor of an undeclared field, without `private`, `#`, `protected` or `readonly`. A method has behaviour unless it is the constructor, an accessor, or a method whose every `return` returns `this`. Excluding methods that return `this` means a fluent builder (`limit = 10; setLimit(n) { this.limit = n; return this }`) is not reported. Its methods are setters, not behaviour. The book's convention is: "data structures had public variables and no functions, whereas objects had private variables and public functions".
- **Fix:** none. Whether the class should become an object or a data structure is a design choice.

#### OBJ-05 · At most one switch per switchable type

- **Chapter:** 12 Objects and Data Structures § The OO/Procedural Trade-off; 7 Clean Functions § Switch Statements; 3 First Principles. **bookCTX:** chunks 6, 12, 20
- **Quote (chunk 20):** "Thus, my general rule for `switch` statements and their ugly duckling sibling, `if` / `else` chains, is that they should be located at the periphery of the system (e.g., the `main` module); there should be, at most, one for each switchable type; and the cases within them must create the polymorphic objects that the rest of the system uses."
- **Class:** syntax.
- **Rule:** `one-switch-per-type` reports the second `switch`, within one class, on the same type code of the object itself. A type code is a member named `type`, `kind`, `typeCode`, or ending in `Type` or `Kind` (`this.type`, `this.shapeKind`). That is the book's case: an object whose behaviour varies by a type field.
- **Threshold:** 1, the book's "at most, one for each switchable type".
- **Not reported:** a `switch` over anything else, including a discriminated union passed as data, or a state field such as `this.state`. The book: "Sometimes you really do want simple data structures with procedures operating on them" (chunk 20). The procedural choice is right "in those parts of the system where behavior is overwhelmingly more volatile than data".
- **Fix:** none. Replacing the switches with polymorphic classes is a redesign.

#### OBJ-06 · Objects and data structures are opposites: choose deliberately

- **Chapter:** 12 Objects and Data Structures § Data/Object Antisymmetry. **bookCTX:** chunk 20
- **Quote:** "Objects hide their data behind abstractions and expose functions that operate on that data. Data structures expose their data and have no meaningful functions."
- **Class:** not lintable as a choice. Its consequences are OBJ-03 and OBJ-04.

#### OBJ-07 · Tell, don't ask

- **Chapter:** 12 Objects and Data Structures § Hiding Structure. **bookCTX:** chunk 20
- **Quote:** "So, we can often fix trainwrecks and Law of Demeter violations by telling objects to do what we want, as opposed to traversing the network of objects to gather all the resources. This advice is called *Tell the Other Guy* ."
- **Class:** not lintable separately. It is the remedy for OBJ-01 and OBJ-02, and each of their messages names it.

### Chapter 13, Clean Classes

#### CLS-01 · One class or module per source file

- **Chapter:** 13 Clean Classes § Classes and Modules versus Files. **bookCTX:** chunk 21
- **Quote:** "Just because you can doesn't mean you should. Generally, stick to a single module or class per source file. You'll create fewer headaches for yourself and your dev team."
- **Class:** built-in.
- **Rule:** `max-classes-per-file` with `max: 1`.
- **Threshold:** 1, the book's value. The book allows exceptions for "very closely related classes within the same source file, such as small structs (e.g., records in Java) or exception types." In TypeScript, such structs are interfaces and types, which this rule does not count. Exception classes are counted. **Owner sign-off:** keep 1, and let projects disable the rule on the line of a co-located error class.
- **Fix:** none (built-in).

#### CLS-02 · Classes should be small, cohesive, with one reason to change

- **Chapter:** 13 Clean Classes § Heuristics and Characteristics. **bookCTX:** chunks 21, 22
- **Quote:** "Such an ideal class is typically small. Its name concisely summarizes the small numbers of behaviors gathered within. And it is defined cohesively: Its methods are closely related and focused, and it performs a single, well-defined task (or set of related tasks) effectively."
- **Class:** not lintable. The book gives no size, and it warns against classes that are too small: "We might not want a "ravioli" system where every class contains only one method". A cohesion metric (which methods use which fields) misreads classes whose methods share no field but serve one actor.

#### CLS-03 · Move a method to the class whose data it uses (feature envy)

- **Chapter:** 13 Clean Classes § Fixing the Problem; 10 One Thing. **bookCTX:** chunks 18, 21
- **Quote:** "The method, apparently envious of the `Holding` class, asks it multiple questions ("What's the date checked in? What's the date due?") in order to compute a result. The `isLate` method also shows disinterest in the `HoldingService` class on which it's defined."
- **Class:** not lintable. In chunk 18 the book keeps a method that uses no fields where it is, because the class "is concerned only with the formatting of the statement". Core `class-methods-use-this` would report that method. The audit kept `@george2f/eslint-plugin-clean-code`'s `no-feature-envy` off for its false reports.

#### CLS-04 · Open-Closed Principle

- **Chapter:** 13 Clean Classes § An Overly Open Implementation; 19 The SOLID Principles § OCP. **bookCTX:** chunks 21, 26
- **Quote (chunk 26):** "In other words, the behavior of a software artifact ought to be extendible, without having to modify that artifact."
- **Class:** not lintable directly. Its syntax proxy is OBJ-05.

#### CLS-05 · No accidental switch fall-through

- **Chapter:** 13 Clean Classes § An Overly Open Implementation. **bookCTX:** chunk 21
- **Quote:** "Ugh, a `switch` statement, and an old-school one at that-the kind where control flow can accidentally drip from one case to the next if you're careless."
- **Class:** built-in.
- **Rule:** `no-fallthrough`.
- **Fix:** none (built-in).

#### CLS-06 · Don't mix policy with implementation detail

- **Chapter:** 13 Clean Classes § When Policies Change. **bookCTX:** chunk 22
- **Quote:** "In other words, don't mix policy with implementation detail. Doing so is costlier to understand, navigate, and maintain. It's also not SRP compliant: A policy change is one reason to make a code change, and implementation details about a step in the policy is another reason."
- **Class:** not lintable. Policy and detail are relative to the domain.

#### CLS-07 · Kent Beck's four rules of simple design

- **Chapter:** 13 Clean Classes § Heuristics and Characteristics; 18 Simple Design. **bookCTX:** chunks 21, 25
- **Quote (chunk 25):** "Therefore, eliminating duplication is third in the priority list of the rules of simple design. First come the tests, then the expression, and *then* the duplication."
- **Class:** not lintable as a whole. The order is why this plugin's naming and readability rules do not give way to size rules.

### Chapters 14 and 15, Testing Disciplines and Clean Tests

These rules apply to test files only. `recommended` scopes them with `files` globs for `*.test.*`, `*.spec.*` and `__tests__/`. They recognise the test functions of the common runners (`it`, `test`, `describe`, and their `.skip`, `.only` and `x` forms). That covers Jest, Vitest, Mocha, `node:test`, rstest and Bun.

#### TST-01 · Test code must be as clean as production code

- **Chapter:** 14 Testing Disciplines § Keeping Tests Clean; 15 Clean Tests § Dual Standard. **bookCTX:** chunks 23, 24
- **Quote:** "The moral of the story is simple: Test code is just as important as production code. It is not a second-class citizen. It requires thought, design, and care. It must be kept as clean as production code."
- **Class:** syntax, as a configuration rule. `recommended` applies every rule to test files too, with one exception.
- **Exception, for owner sign-off:** in test files, `max-lines-per-function` is off. A `describe(() => { … })` callback is a group of tests, not a function in the book's sense, and four one-line tests already make it longer than 12 lines. ESLint cannot tell that callback apart from other functions, so the rule is turned off for the whole test file. The book measures tests by the Single Act Rule (TST-02), not by line count. Every other rule, `max-block-statements` and `complexity` included, still applies.

#### TST-02 · Arrange, Act, Assert; the Single Act Rule

- **Chapter:** 15 Clean Tests § Act Rule. **bookCTX:** chunk 24
- **Quote:** "We want to avoid tests that arrange, act, assert, act, assert. We also want to avoid tests that arrange, act, act, assert, assert. We want every action tested individually because we don't want downstream assertions to be corrupted by upstream actions."
- **Class:** not lintable. Telling the "act" from the "arrange" means knowing which call is the system under test. Counting assertions would contradict the book: "a test can have many assertion statements and still assert one logical fact."

#### TST-03 · F.I.R.S.T.: Fast

- **Chapter:** 15 Clean Tests § Fast. **bookCTX:** chunk 24
- **Quote:** "Eventually the code will begin to rot. So consider the speed of the tests to be a design imperative. Design your tests to be fast. Very fast."
- **Class:** not lintable. Speed is measured at run time.

#### TST-04 · F.I.R.S.T.: Isolated

- **Chapter:** 15 Clean Tests § Isolated. **bookCTX:** chunk 24
- **Quote:** "Tests should not depend on each other. One test should not set up the conditions for the next test. You should be able to run each test independently and run the tests in any order you like."
- **Class:** syntax.
- **Rule:** `no-shared-test-state` reports an assignment, inside a test callback (`it` or `test`), to a variable declared outside the test. Assignments in `beforeEach` and `afterEach` hooks are allowed, because they reset state for every test.
- **Fix:** none. Moving the state into each test or into a hook is a restructuring of the test file.

#### TST-05 · F.I.R.S.T.: Self-validating

- **Chapter:** 15 Clean Tests § Self-Validating. **bookCTX:** chunk 24
- **Quote:** "The tests should have a boolean output. Either they pass or they fail. You should not have to read through a log file to tell whether the tests pass."
- **Class:** syntax.
- **Rule:** `test-asserts` reports a test callback that makes no assertion. An assertion is a call whose callee is `expect` or `assert`, or starts with either (`expect(…)`, `assert.equal(…)`, `assertTaxFor(…)`). That counts the book's composed assertions, and `node:assert` calls. The audit found `@george2f/eslint-plugin-clean-code`'s `one-assertion-per-test` blind to `assert.*`. A test that has `.todo`, or is skipped, is not checked. An `assertFunctionNames` option adds project helpers.
- **Fix:** none. The missing assertion has to say what the test expects.

#### TST-06 · F.I.R.S.T.: Repeatable and Timely

- **Chapter:** 15 Clean Tests § Repeatable, § Timely. **bookCTX:** chunk 24
- **Quote:** "Tests should be repeatable in any environment. You should be able to run the tests in the production environment, in the QA environment, and on your laptop while riding home on the train without a network."
- **Class:** not lintable. Whether a call reaches the network or the clock depends on what is mocked, and that is set up outside the test file. Timeliness is about when the test was written.

#### TST-07 · Don't disable failing tests

- **Chapter:** 31 Small Cycles § Continuous Build; 5 Comments § Warning of Consequences. **bookCTX:** chunks 38, 9
- **Quote (chunk 38):** "The more you ignore those failures, the more annoying the failure alerts become. And the more tempted you are to turn the failing tests off until you can fix them-later."
- **Class:** syntax.
- **Rule:** `no-disabled-tests` reports `it.skip`, `test.skip`, `describe.skip`, `xit`, `xtest`, `xdescribe` and `{ skip: true }` options, unless a comment directly before the call gives a reason. The book allows a disabled test that carries its reason, as JUnit's `@Ignore("Takes too long to run")` does (chunk 9).
- **Fix:** none. Removing `.skip` runs a test that is failing, which changes what the suite does.

#### TST-08 · Domain-specific testing language and composed assertions

- **Chapter:** 15 Clean Tests § Domain-Specific Testing Language, § Composed Assertions, § Composed Test Results. **bookCTX:** chunks 23, 24
- **Quote:** "Rather than using the APIs that programmers use to manipulate the system, we build up a set of functions and utilities that make use of those APIs and that make the tests more convenient to write and easier to read."
- **Class:** not lintable. The book says these helpers "are not designed up front; rather, they evolve from the continued refactoring of test code", so there is nothing to require at a given moment.

#### TST-09 · Tests document behaviour; don't test implementation details

- **Chapter:** 13 Clean Classes § Simpler Testing; 15 Clean Tests § Test Design. **bookCTX:** chunks 22, 24
- **Quote (chunk 24):** "The principles and rules of software design apply to the tests as much as they apply to the production code. Coupling must be minimized. One change to the signature of a function in the production code must not cause hundreds of tests to be altered, just as it must not cause hundreds of other modules to be altered."
- **Class:** not lintable. Coupling between tests and production code is measured across many files, and the book permits testing private details "as a last resort".

#### TST-10 · Test coverage: 100% is the goal, but never a gate

- **Chapter:** 18 Simple Design § Covered by Tests; 32 Relentless Improvement § Test Coverage. **bookCTX:** chunks 25, 38
- **Quote (chunk 38):** "Don't turn them into management metrics. Don't fail the build if your test coverage is too low. Test coverage is a complicated concept that should not be used so naively."
- **Class:** not lintable. Coverage is measured by a coverage tool, and the book says not to gate on it.

### Chapters 18 to 21, Design: Simple Design, SOLID, Component Principles, Continuous Design

#### CD-01 · Return the boolean expression directly

- **Chapter:** 21 Continuous Design § Return Boolean Expressions. **bookCTX:** chunk 30
- **Quote:** "We rarely say that things are flat-out wrong in programming, but this is one of those cases. Simply (and we don't use that word lightly) return the boolean expression:"
- **Class:** syntax for the `if` form, and built-in for the ternary form.
- **Rules:**
  - `return-boolean-directly` reports `if (c) { return true; } else { return false; }`, its inverse, and the same with the `else` left out when the `if` is followed directly by the other `return`.
  - Core `no-unneeded-ternary`, with its default options, reports `c ? true : false`.
- **Fix:** `return-boolean-directly` writes `return c;` when `c` is already a boolean by its syntax: a comparison, `!x`, `instanceof`, `in`, a boolean literal, or `&&`/`||` of these. Otherwise it writes `return !!(c);`, or `return !(c);` for the inverse. The parentheses keep a sequence expression (`a, b`) or an operator of lower precedence in one piece. The function returns exactly the same `true` or `false` as before for every value of `c`. Comments from inside the statement are moved above the `return`, because a line comment between `return` and its value would end the statement.

#### CD-02 · No unnecessary `else` after `return`

- **Chapter:** 21 Continuous Design § Unnecessary Else. **bookCTX:** chunk 30
- **Quote:** "we should at least have the decency to not include the unnecessary `else` keyword. An early return suffices:"
- **Class:** built-in.
- **Rule:** `no-else-return` with `allowElseIf: false`.
- **Fix:** built-in.

#### CD-03 · Braces on a single-statement `if` are optional

- **Chapter:** 21 Continuous Design § Unnecessary Else. **bookCTX:** chunk 30
- **Quote:** "No, we really don't need the braces, though odds are good our team has adopted a coding standard that insists on them. But it's really just overprotective clutter."
- **Class:** not lintable as a rule. The book allows both styles and defers to the team's standard, so there is nothing to report. This is also why `recommended` does not set `curly`.

#### CD-04 · Declare intent: prefer declarative iteration over index loops

- **Chapter:** 21 Continuous Design § Declare Intent, Don't Ooze Details. **bookCTX:** chunk 29
- **Quote:** "The old-school code also has a dramatically increased possibility of hiding defects (hearken back to the `for` loop example)."
- **Class:** built-in.
- **Rule:** `@typescript-eslint/prefer-for-of`, which reports an index `for` loop that only reads `arr[i]`. It runs on JavaScript files as well and needs no type information. Oxlint runs it natively.
- **Fix:** none (built-in). The book's example defect, `i <= words.length`, cannot occur in a `for…of`.

#### CD-05 · Name the lambdas in long pipelines

- **Chapter:** 21 Continuous Design § Keeping Pipelines Streamlined. **bookCTX:** chunk 29
- **Quote:** "Replacing all the in-line lambdas-even the very short functions-with named functions does wonders for our ability to quickly follow the entire flow:"
- **Class:** not lintable. The book also says "it's reasonable to code short in-line functions within a pipeline", and gives no length at which a pipeline needs names.

#### CD-06 · Concise, not obfuscated

- **Chapter:** 21 Continuous Design § Conciseness, § Conciseness Nits. **bookCTX:** chunk 30
- **Quote:** "Every unnecessary token adds to the clutter of our code. We can and should often use things like idiomatic constructs and syntactic sugar to reduce the amount of unnecessary code that we must scan and mentally assemble."
- **Class:** not lintable as a whole. Its two concrete cases are CD-01 and CD-02. Which other tokens are "unnecessary" is a matter of style, which the book leaves to the team.

#### CD-07 · Group related data instead of passing many parameters

- **Chapter:** 21 Continuous Design § Conciseness. **bookCTX:** chunk 30
- **Quote:** "Yet there's still something amiss with our function. The excessive number of parameters returned and passed about not only muddles the solution, but also decreases its concision."
- **Class:** built-in, through FN-04.

#### SOL-01 · Single Responsibility Principle: a module answers to one actor

- **Chapter:** 19 The SOLID Principles § SRP, § Accidental Duplication. **bookCTX:** chunk 26
- **Quote:** "It occurs because we put code that different actors depend upon into close proximity. The SRP says to *separate the code that different actors depend upon* ."
- **Class:** not lintable. Actors are people in the organisation, not code.

#### SOL-02 · Dependency Inversion: depend on abstractions; dependencies point toward policy

- **Chapter:** 19 The SOLID Principles § DIP, § A Thought Experiment; 3 First Principles; 25 Architectural Boundaries; 27 The Clean Architecture § The Dependency Rule. **bookCTX:** chunks 6, 26, 27, 33, 34
- **Quote (chunk 34):** "Nothing in an inner circle can know anything at all about something in an outer circle. In particular, the name of something declared in an outer circle must not be mentioned by the code in an inner circle."
- **Class:** not lintable by this plugin. Which directory is "inner" is specific to each project, so the shared `recommended` config has nothing to check. A project that declares its layers can enforce them with core `no-restricted-imports` per directory. The README will show how. This also covers keeping SQL, frameworks, the database, the UI and vendor APIs at the edge (chapters 18, 25, 26 and 27; chunks 25, 33, 34, 35).

#### SOL-03 · Liskov Substitution: callers must not special-case subtypes

- **Chapter:** 19 The SOLID Principles § LSP. **bookCTX:** chunk 26
- **Quote:** "The only way to defend against this kind of LSP violation is to add mechanisms to the `User` (such as an `if` statement) that detect whether the `Rectangle` is, in fact, a `Square` . Since the behavior of the `User` depends on the types it uses, those types are not substitutable."
- **Class:** types.
- **Rule:** `no-subtype-check` reports `x instanceof S` when the declared type of `x` is a class or interface `T` declared in the project and `S` is a proper subclass of `T`. A check against a type unrelated to `x`'s declared type is not reported, and neither is a discriminated union's `kind` check, because that is a data structure's tag, not a subtype test.
- **Fix:** none. The remedy is to move the varying behaviour into the subtypes.

#### SOL-04 · Interface Segregation: don't depend on more than you need

- **Chapter:** 19 The SOLID Principles § ISP and Design. **bookCTX:** chunk 26
- **Quote:** "In general, it is harmful to depend upon modules that contain more than you need. This is obviously true for source code dependencies that can force unnecessary recompilation and redeployment."
- **Class:** not lintable. The book frames ISP at the level of modules and deployments. Counting how many members of a parameter's type a function uses would report functions that pass the parameter on, which is how they serve a client that needs the rest.

#### SOL-05 · Don't derive from volatile concrete classes

- **Chapter:** 19 The SOLID Principles § Stable Abstractions. **bookCTX:** chunk 27
- **Quote:** "**Don't derive from volatile concrete classes.** This is a corollary to the previous rule, but it bears special mention. In statically typed languages, inheritance is the strongest and most rigid of all the source code relationships, and it should be used with great care."
- **Class:** types.
- **Rule:** `no-concrete-inheritance` reports `class A extends B` when `B` is declared in the project (not in the TypeScript library or `node_modules`) and is not `abstract`. Stable platform classes such as `Error` are not reported. The book calls out "the *volatile* concrete elements of our system", and says "While these are written as rules, they are actually more like warnings".
- **Fix:** none. Making `B` abstract or introducing an interface is a redesign.

#### SOL-06 · Don't override concrete functions

- **Chapter:** 19 The SOLID Principles § Stable Abstractions. **bookCTX:** chunk 27
- **Quote:** "**Don't override concrete functions.** Concrete functions often require source code dependencies. When you override those functions, you do not eliminate those dependencies-indeed, you *inherit* them. To manage those dependencies you should make the function abstract and create multiple implementations."
- **Class:** types.
- **Rule:** `no-concrete-inheritance` also reports a method that overrides a non-abstract method of a project base class.
- **Fix:** none, for the same reason as SOL-05.

#### SOL-07 · Don't refer to volatile concrete classes; gather creation in `main`

- **Chapter:** 19 The SOLID Principles § Stable Abstractions, § Concrete Components; 26 Clean Boundaries § UI/Application Boundary. **bookCTX:** chunks 27, 34
- **Quote (chunk 27):** "DIP violations cannot be entirely removed; but they can be gathered into a small number of concrete components and kept separate from the rest of the system."
- **Class:** not lintable by this plugin, for the same reason as SOL-02. Which file is the composition root is specific to each project.

#### SOL-08 · Component principles: REP, CCP, CRP, ADP, SDP, SAP, the main sequence

- **Chapter:** 20 Component Principles. **bookCTX:** chunks 27, 28, 29
- **Quote (chunk 28):** "Thus, the dependency structure must always be monitored for cycles. When cycles occur, they must be broken somehow. Sometimes this will mean creating new components, making the dependency structure grow."
- **Class:** not lintable by this plugin. All of these are properties of the whole project's import graph: cycles, fan-in, fan-out, and abstractness per component. Per ADR 0002, every rule here stays within the per-file rule API that ESLint and Oxlint share. The book also says: "I am not suggesting that you should measure and calculate all these metrics." (chunk 29)

#### SOL-09 · Cohesion: keep persistence apart from domain logic

- **Chapter:** 21 Continuous Design § Cohesion. **bookCTX:** chunk 31
- **Quote:** "The module `database.js` provides an interface that abstracts the notion for persisting data, with nothing exported that betrays the underlying data structure. Future changes to its implementation don't impact other code in the system."
- **Class:** not lintable. Which code is storage and which is domain logic is a judgment about the project.

#### SOL-10 · Testable code is decoupled code

- **Chapter:** 18 Simple Design § Design?. **bookCTX:** chunk 25
- **Quote:** "That means those parts must be so well decoupled from the rest of the code that they can be isolated and invoked from an individual test. Therefore, those tests are not only tests of behavior, *they are also tests of decoupling* ."
- **Class:** not lintable. Testability is shown by the tests, not by the code's syntax.

### Chapter 22, Concurrency

#### CON-01 · Keep concurrency code separate; limit the scope of shared data

- **Chapter:** 22 Concurrency § Single Responsibility Principle, § Corollary: Limit the Scope of Data, § Conclusion. **bookCTX:** chunks 31, 33
- **Quote (chunk 33):** "Keep the number of shared objects and the scope of the sharing as narrow as possible. Change designs of the objects with shared data to accommodate clients rather than forcing clients to manage shared state."
- **Class:** not lintable by this plugin. JavaScript shares memory between threads only through `SharedArrayBuffer`, and which modules are "thread-aware" is a project decision. ONE-05 covers the one case the book names in code, mutable statics.

#### CON-02 · Keep critical sections small; don't nest locked sections

- **Chapter:** 22 Concurrency § Keep Synchronized Sections Small, § Conclusion. **bookCTX:** chunks 32, 33
- **Quote:** "Learn how to find regions of code that must be locked, and lock them. Do not lock regions of code that do not need to be locked. Avoid calling one locked section from another."
- **Class:** not lintable. JavaScript has no `synchronized`. Locking is done through libraries whose calls a generic rule can't recognise.

#### CON-03 · Testing threaded code: pluggable, tunable, run on all platforms, don't ignore one-offs

- **Chapter:** 22 Concurrency § Testing Threaded Code and its recommendations. **bookCTX:** chunk 32
- **Quote:** "This often leads developers to write off the failure as a cosmic ray, a hardware glitch, or some other kind of "one-off." It is best to assume that one-offs do not exist. The longer these one-offs are ignored, the more code is built on top of a potentially faulty approach."
- **Class:** not lintable. These are about how tests are run.

### Chapters 28 to 32, Craftsmanship

#### HRM-01 · Remove dead code

- **Chapter:** 28 Harm § No Harm to Structure. **bookCTX:** chunk 36
- **Quote:** "Remember that the Knight Capital debacle would not have happened if the old Power-Peg code had been removed from the codebase. It was that old, defunct code that actually made the bad trades."
- **Class:** built-in.
- **Rules:** `no-unreachable`, and `no-unused-vars` (for TypeScript, `@typescript-eslint/no-unused-vars`).
- **Fix:** none, in any `--fix` mode. Each linter needs its own setting:
  - **ESLint core:** `no-unused-vars` offers suggestions, not fixes.
  - **typescript-eslint:** `@typescript-eslint/no-unused-vars` can remove unused imports under `--fix` through its `enableAutofixRemoval.imports` option. `recommended` sets that option to `false` explicitly.
  - **Oxlint 1.92:** its `no-unused-vars` fixes are suggestions by default, and `--fix-suggestions` applies them. In a check on 2026-11-06, that turned `import type { A, B }` into `import type { B }` and deleted an unused value import outright, dropping its side effects. `recommended` for Oxlint sets the rule's `fix` option to `{ imports: "off", variables: "off" }`.
  
  Oxlint's schema marks that option experimental. The Oxlint release pinned in CI must support it, or this guard is lost.
- A function declaration after a `return` is hoisted and reachable. Core `no-unreachable` does not report it. A regression test covers it.

#### HRM-02 · Avoid global variables

- **Chapter:** 28 Harm § No Harm to Structure. **bookCTX:** chunk 36
- **Quote:** "Clearly, thousands of global variables is a structural flaw. So is dead code left in the codebase."
- **Class:** not lintable as a rule this plugin adds. ES modules have no implicit globals. Module-level `let` is the module's own state, which the book does not condemn ("thousands" is the flaw), and it gives no number.

#### HRM-03 · Rigidity, fragility and immobility

- **Chapter:** 29 No Defect in Behavior or Structure § What Is Good Structure?. **bookCTX:** chunk 37
- **Quote:** "Fragility is when minor changes to the behavior of a system force many corresponding changes in a large number of modules. This creates a high risk that a small change in behavior will silently break some other behaviors in the system that then get inadvertently deployed."
- **Class:** not lintable. These smells are measured by the cost of a change across many files and over time. The book's definitions of rigidity and immobility are in the same section.

#### HRM-04 · Make it work, then make it right; the Boy Scout Rule

- **Chapter:** 1 Clean Code § The Boy Scout Rule; 29 No Defect in Behavior or Structure § Making It Right; 32 Relentless Improvement. **bookCTX:** chunks 3, 36, 38
- **Quote (chunk 38):** "*Check the code in cleaner than you checked it out.* How? By performing random acts of kindness upon the code every time you check it in. One of those random acts of kindness is to increase test coverage."
- **Class:** not lintable. This is a practice. The README will explain how to adopt `recommended` on an existing codebase change by change.

### Appendix: The Clean Code Debate

#### DEB-01 · Over-decomposition is possible; extract only meaningfully

- **Chapter:** Appendix, The Clean Code Debate. **bookCTX:** chunks 41, 44
- **Quote (chunk 41):** "If I can *meaningfully* extract one method from another, then the original method did more than one thing. "Meaningfully" means that the extracted functionality can be given a descriptive name, and that it does less than the original method."
- **Class:** not lintable. This is the counterweight to FN-01: the debate agrees that functions can be split too far. ONE-02 reports the one case the debate settles, a wrapper whose body says no more than its name.

#### DEB-02 · Comment interfaces of public and cross-team APIs; comment the non-obvious

- **Chapter:** Appendix, The Clean Code Debate. **bookCTX:** chunk 42
- **Quote:** "Yes, there are times when the signature of a method is an incomplete abstraction and a comment is required. This is especially true when the interface is part of a public API, or an API intended for use by a separate team of developers."
- **Class:** not lintable. Whether a signature is "an incomplete abstraction" is semantic. This passage is why no comment rule here reports a doc comment that adds information.

## Thresholds the book does not state

These values are this catalog's choices. Approving the pull request approves them.

| Entry | Rule | Value | Reason |
| --- | --- | --- | --- |
| FN-02 | `complexity` | 15 | The book gives no number for decision points. 15 is stricter than ESLint's default of 20, and equals the limit the adopting projects use today. |
| CMT-06 | `no-journal-comments` | 3 dated lines | One or two dated lines are usually an "as of" note, not a change log. |
| FH-03 | `no-param-reassign` | `acc` and `accumulator` exempt | A `reduce` accumulator is the callback's own value, not the caller's. |
| NAM-02 | `name-length-matches-scope` | one-letter names only in scopes of 3 lines or fewer | The book's example is "two lines long" with no maximum. 3 covers a one-line callback or a three-line loop. |
| CMT-07 | `no-position-markers` | a run of 5 or more of one punctuation character | No number in the book. 5 is longer than any punctuation in ordinary prose (`...`, `--`). |
| OBJ-02 | `no-getter-chains` | 2 chained `get*()` calls | The book's example has 3 and no limit. A getter called on a getter's result is the smallest chain. |
| ONE-04 | `no-complex-condition` | a mix of `&&` and `\|\|`, or more than 3 operands | The book's example mixes them. 3 lets `a && b && c` pass. |
| CMT-10 | `no-warning-comments` | terms `todo`, `fixme` | The book names TODO. FIXME is the same comment. |
| NAM-06 | `id-denylist` | adds `I` to the book's `l` and `O` | It has the same problem as `l`. |

Interpretations of stated values, also for sign-off:

| Entry | Rule | Book value | How it is read |
| --- | --- | --- | --- |
| FN-01 | `max-lines-per-function` | "a dozen lines or less" | 12, skipping blank lines and comments. The book also mentions 3 to 6, and 20 or 25 as "up to you". |
| FN-03 | `max-depth` | "seldom be greater than one or two" | 2 nested blocks inside the function body. |
| FN-05 | `max-block-statements` | "only one or two lines long" | 2 statements, so that wrapped lines don't count. |
| FN-04 | `max-params` | "three is usually my limit" | 3, not counting a TypeScript `this` parameter. |
| CLS-01 | `max-classes-per-file` | "a single module or class per source file" | 1, counting exception classes too. |

## Custom rules with no autofix

Each rule's doc page will have a "Why there is no autofix" section with the reason below. Approving the pull request approves each exception.

| Rule | Why no fix keeps behaviour unchanged |
| --- | --- |
| `error-handling-is-one-thing` | Extracting the `try` into a new function changes what `return`, `break`, `continue`, `await` and `yield` inside it mean, and the function needs a name. |
| `max-block-statements` | The remedy is extracting a named function. The name must describe what the block means. |
| `no-protected-fields` | Making the field private breaks the subclasses that use it. Making it public widens access. |
| `no-noise-words` | Removing the word can leave an empty or colliding name. A better name needs the meaning. |
| `no-number-series-names` | Needs a name that says what each value is. |
| `name-length-matches-scope` | Needs a name that says what the value is. |
| `no-side-effects-in-predicates` | The remedy is renaming or separating the effect, and both need a choice. |
| `no-command-query-mix` | Splitting into a query and a command needs two names. |
| `one-switch-per-type` | Replacing the switches with polymorphism is a redesign. |
| `no-getter-chains` | Splitting the chain into temporaries does not remove the coupling. The book's remedy moves behaviour. |
| `no-hybrid-class` | Choosing object or data structure is a design decision. |
| `no-trivial-accessors` | Public fields behave differently from accessors under `Object.keys`, spreading, JSON and `defineProperty`. |
| `no-complex-condition` | Needs a predicate name. Hoisting the condition into a `const` also changes when it runs in `while` and `else if`. |
| `no-mutable-static-state` | Turning static members into instance members changes every caller and how many copies of the state exist. |
| `no-overloaded-constructors` | Each factory method needs a name that describes its arguments. |
| `no-disabled-tests` | Removing `.skip` runs a failing test, which changes what the suite does. |
| `test-asserts` | The missing assertion has to say what the test expects. |
| `no-shared-test-state` | Moving state into each test or a hook restructures the file. |
| `law-of-demeter` | The remedy moves behaviour into another class. |
| `no-container-in-name` | The right name depends on what the grouping is. |
| `predicate-returns-boolean` | Needs either a new name or a different return type, which changes callers. |
| `no-concrete-inheritance` | Introducing an abstraction is a redesign. |
| `no-subtype-check` | The varying behaviour has to move into the subtypes. |

Partial fixes, for sign-off with the rest. In each case below the rule reports and does not fix.

- `no-flag-argument`: methods, exported functions, functions passed as values, a boolean that is not the last parameter, and functions that use `arguments` (FH-01).
- `no-encodings`: anything other than a local variable, a plain parameter or a `#private` member in an ES module, and any binding used in shorthand or destructuring (NAM-09, NAM-10).
- `no-pure-delegator`: an `async` or generator delegator, one with non-plain parameters, or one called with a different number of arguments, `new` or a tagged template (ONE-02).
- `stepdown-order`: class methods, functions in blocks or in sloppy-mode code, duplicate names, and decorated functions (FMT-04).
- `fields-first`: a moved field with a computed key, and classes with decorators, `static` blocks, auto-accessors, or initializers that refer to the class (FMT-03).
- `loop-variable-in-loop`: any reference outside the `for` statement or inside a nested function, a declaration with other declarators or an initializer, or a loop init that assigns more than the variable (FMT-05).
- `no-attribution-comments`: a byline inside a comment with other text (CMT-08).
- `no-html-in-comments`: double-escaped entities, and a tag whose removal would end the comment (CMT-09).

## How fixes stay safe

Every fix in this plugin follows these rules, and each has a test under ESLint and under Oxlint.

1. **Removing or moving code never joins two statements.** In code without semicolons, a line starting with `(`, `[`, `` ` ``, `+`, `-`, `/` or `*` continues the previous statement. When a fix removes a statement or member, or moves one, and the code that now precedes such a line has no `;`, the fix inserts one. This includes the case where the following line already starts with `;`, which the fix keeps.
2. **Deleting a comment never changes how the code around it parses.**
   - A block comment that contains a line break is replaced by a line break, because a line break can end a statement (`return /* … \n … */ 42`).
   - A comment with code characters on both sides is replaced by one space, so `return/*x*/value` does not become `returnvalue`.
   - Only the comment's own text and the blank space left on its line are removed.
3. **Directive comments are never changed.** These are `eslint-*`, `oxlint-*`, `@ts-*`, `prettier-ignore`, `#__PURE__`, `#__NO_SIDE_EFFECTS__`, `/// <reference`, `@license`, `@preserve`, `@jsx` pragmas and webpack magic comments.
4. **A fix is idempotent.** Running `--fix` again on its output changes nothing.
5. **Every fix is tested three ways.** The tests check the output text, run the code before and after on the same inputs and compare the results, and lint the output to show the rule no longer reports it.

## Regression cases

An audit of `@george2f/eslint-plugin-clean-code` found fixes that change what code does, and rules that misfire. Each finding below is a required test in this repository. The tests run under ESLint and Oxlint, with every fixable rule in `recommended` enabled and `--fix` applied.

| Finding in the audit | How this plugin avoids it | Test |
| --- | --- | --- |
| `no-dead-code` turned `import type { A, B }` into a runtime `import { B }`, and an all-unused import into a side-effect import | No custom rule removes or rewrites an import declaration. `no-encodings` does not rename imported bindings. `no-unused-vars` has no fix in ESLint core. `recommended` turns off the import fixes of `@typescript-eslint/no-unused-vars` and of Oxlint's `no-unused-vars` (HRM-01). | `import type { A, B } from "./x"` with only `B` used, and `import type { IShape } from "./x"`: the output equals the input under `--fix`, and under Oxlint's `--fix-suggestions` and `--fix-dangerously`. |
| `no-clutter` removed private and protected constructors, and overload implementations (TS2390) | The only custom fix that removes a function is `no-pure-delegator`, and only for a non-exported, non-overloaded function declaration (ONE-02). No custom fix removes a class member. `stepdown-order` moves an overload group as one block, and `no-flag-argument` rewrites overload signatures with the implementation. | A class with a `private constructor()`, a `protected constructor()` and an overloaded method, and an overloaded function with a boolean parameter: the output still has every member and signature, and still type-checks. |
| `no-clutter` removed a leading `;` in code without semicolons | Rule 1 of [How fixes stay safe](#how-fixes-stay-safe). | In code without semicolons, a `;[1, 2].forEach(f)` line directly after each of these: a commented-out line, a delegator, a misplaced function declaration, a `let i` before a loop, and a class field followed by `[Symbol.iterator]() {}`. After `--fix` every `;` is still there, and the output parses to the same statements as the input apart from the intended change. |
| `no-dead-code` reported hoisted functions after a `return` as unreachable | Core `no-unreachable` does not report function declarations. No custom rule checks reachability. | A function declaration after `return`, called before it: no report. |
| `command-query-separation` reported `getOrCreate` and fluent setters | `no-command-query-mix` reports only a boolean-returning command used as a condition (FH-04). `no-flag-argument` and `no-hybrid-class` skip methods that return `this` (FH-01, OBJ-04). `no-getter-chains` does not count `getOr…` calls as getters (OBJ-02). | A `getOrCreate(key)` method, a `setName(n) { this.name = n; return this; }`, a builder with public fields and `this`-returning setters, and `registry.getOrCreate(key).getName()`: no report from `recommended`. |
| `law-of-demeter`, `no-output-arguments` and `function-does-one-thing` reported parameter objects | `law-of-demeter` ignores data structures and property reads (OBJ-01). `no-param-reassign` reports only writes to a parameter (FH-03). There is no "does one thing" rule. | `function f({ a, b }: Opts)` and `function g(opts: Opts) { return opts.limits.max; }`: no report from either config. |
| `prefer-polymorphism` reported discriminated unions | `one-switch-per-type` checks only switches on a type-code member of `this` (OBJ-05). | Two functions that each `switch (shape.kind)`, and a class that switches on `this.state` in two methods: no report. |
| `one-assertion-per-test` was blind to `assert.*` | `test-asserts` counts `assert` and `assert.*` calls (TST-05). | A test whose only assertion is `assert.equal(…)`: no report. |

Reports on these patterns that remain, each listed in its entry for approval:

- A free function that writes into a cache passed to it (`getOrCreate(cache, key, make)`) is reported by `no-param-reassign` as an output argument, and so is a free-function fluent setter (FH-03).
- `registry.getOrCreate(key).add(item)` is reported by `law-of-demeter` in `recommended-type-checked` when the result is an object (OBJ-01).
- An exhaustive `switch` over a large discriminated union is reported by `complexity` from 15 members, and by `max-lines-per-function` from about five cases (FN-02).

## Not in this plugin, and where it goes instead

- **Formatting** (FMT-06, FMT-07, FMT-08): the project's formatter, with a print width of 120.
- **Layers, boundaries and components** (SOL-02, SOL-07, SOL-08): each project's own `no-restricted-imports`. The README will show an example.
- **Duplication** (FH-09): a clone detector run across the whole project, outside the linter.
- **Coverage and mutation testing** (TST-10, and 32 Relentless Improvement § Mutation Testing, chunk 38): the test runner's coverage and a mutation tester, not gates.
- **Entries a model could check** (names, abstraction levels, comment accuracy): a follow-up, as the plan says.

## How this catalog was made

The whole book (bookCTX chunks 1 to 48: front matter, all 37 chapters, the Appendix and the index) was read through the bookCTX MCP. Each chunk was read in full with `get_chunk`, and every guideline about source code was recorded with a quote copied from the chunk text. Chunks 1 and 2 are front matter. Chunks 45 to 48 are the index. Process advice that says nothing checkable about code is left out: estimation, meetings, career, TDD's three laws as a workflow, and continuous integration. Three tables the text refers to are images missing from the bookCTX text: the L-by-P duplication table in chunk 14, and two tax tables in chunk 16. No threshold is taken from them.

The second edition has no single "smells and heuristics" chapter like the first edition's Chapter 17. Its smells are spread through the chapters, and this catalog follows them there.
