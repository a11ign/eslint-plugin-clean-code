import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-noise-words.ts";

runRuleTests("no-noise-words", rule, {
  valid: [
    "const name: string = 'a';",
    { name: "the suffix is reported only when the declared type repeats it", code: "let nameString = 'a'; let idObject: number = 1; let labelString: string[] = [];" },
    { name: "a name that is only the type's word has nothing to drop", code: "function f(string: string, object: object) { return [string, object]; }" },
    { name: "`variables`, `variance` and `invariable` are other words", code: "const variables = []; const variance = 1; const invariable = 2;" },
    { name: "the word table is left out: the book means database tables", code: "const userTable = new Map(); class TableView {}" },
    { name: "`Database`, `Metadata` and `Information` are not the word `Data` or `Info`", code: "class Database {} class Metadata {} class Information {} class Infobox {}" },
    { name: "a function name is not a variable, parameter or property", code: "function readVariable() { return 1; }" },
    { name: "a destructuring key names someone else's property", code: "const { envVariable: env } = process;" },
    { name: "an imported name is declared in another file", code: 'import { configVariable } from "./x";\nexport const c = configVariable;' },
    { name: "a method is not a property", code: "const o = { getVariable() { return 1; } };" },
  ],
  invalid: [
    { name: "the word variable in a variable name", code: "const myVariable = 1;", output: null, errors: [{ messageId: "variableWord" }] },
    { name: "the word variable in a parameter and a catch parameter", code: "function f(variableName) { try { return variableName; } catch (errorVariable) { return errorVariable; } }", output: null, errors: 2 },
    { name: "the word variable in snake case", code: "const ENV_VARIABLE = 'x';", output: null, errors: 1 },
    { name: "`NameString` annotated `string`", code: "let nameString: string = 'a';", output: null, errors: [{ messageId: "typeSuffix" }] },
    { name: "a suffix repeating the wrapper type `String` and `Object`", code: "function f(titleString: String, configObject: Object) { return [titleString, configObject]; }", output: null, errors: 2 },
    { name: "a parameter with a default keeps its annotation", code: "function f(labelString: string = '') { return labelString; }", output: null, errors: 1 },
    { name: "a class property and an interface property", code: "class A { nameString: string = ''; #idObject: object = {}; }\ninterface B { keyString: string; settingsVariable: number }", output: null, errors: 4 },
    { name: "a parameter property", code: "class A { constructor(private nameString: string) {} }", output: null, errors: 1 },
    { name: "an object literal property", code: "const o = { tempVariable: 1, 'otherVariable': 2 };", output: null, errors: 2 },
    { name: "a destructured binding", code: "const { a: myVariable } = { a: 1 };", output: null, errors: 1 },
    { name: "`Manager`, `Processor`, `Data` and `Info` in class names", code: "class UserManager {}\nclass PaymentProcessor {}\nclass CustomerData {}\nconst AccountInfo = class AccountInfo {};", output: null, errors: [{ messageId: "classNoise", line: 1 }, { messageId: "classNoise", line: 2 }, { messageId: "classNoise", line: 3 }, { messageId: "classNoise", line: 4 }] },
    { name: "the word in the middle or in snake case", code: "class DataSource {}\nclass HTTP_Info_Cache {}", output: null, errors: 2 },
  ],
});
