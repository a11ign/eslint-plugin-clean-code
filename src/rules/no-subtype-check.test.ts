import { runTypedRuleTests, runWithoutTypeInformation } from "../testing/run-typed-rule-tests.ts";
import rule from "./no-subtype-check.ts";

const RECTANGLE = "class Rectangle { constructor(public w: number, public h: number) {} }\nclass Square extends Rectangle { constructor(side: number) { super(side, side); } }";
const SHAPE = "interface Shape { area(): number }\nclass Circle implements Shape { area() { return 3; } }\nclass Box implements Shape { area() { return 1; } }";

runTypedRuleTests("no-subtype-check", rule, {
  valid: [
    { name: "catalog row 7 regression: a discriminated union's tag tested in an `if` is a data structure's tag, not a subtype test", code: "type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };\nfunction area(shape: Shape) { if (shape.kind === 'circle') return shape.r ** 2; return shape.side ** 2; }" },
    { name: "catalog row 7 regression: a discriminated union's tag in a `switch` is a data structure's tag, not a subtype test", code: "type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };\nfunction area(shape: Shape) { switch (shape.kind) { case 'circle': return 3; case 'square': return 1; } }" },
    { name: "a check against a type unrelated to the declared type", code: `${RECTANGLE}\nclass Circle {}\nfunction f(r: Rectangle) { return r instanceof Circle; }` },
    { name: "a check against the declared type itself", code: `${RECTANGLE}\nfunction f(r: Rectangle) { return r instanceof Rectangle; }` },
    { name: "`unknown` has no single declared supertype", code: "function f(error: unknown) { return error instanceof Error; }" },
    { name: "`any` has no single declared supertype", code: `${RECTANGLE}\nfunction f(x: any) { return x instanceof Square; }` },
    { name: "a union has no single declared supertype", code: `${RECTANGLE}\nfunction f(x: Square | Date) { return x instanceof Square; }` },
    { name: "a caught error is `unknown` or `any`: no single declared supertype", code: "try { JSON.parse('x'); } catch (error) { if (error instanceof SyntaxError) throw error; }" },
    { name: "a library supertype: `Error` subclasses are the platform's, not the project's", code: "function f(e: Error) { return e instanceof TypeError; }" },
    { name: "a project's own `Error` subclass, checked against the platform's `Error` supertype", code: "class AppError extends Error {}\nfunction f(e: Error) { return e instanceof AppError; }" },
    { name: "a right-hand side that is not a class", code: `${RECTANGLE}\ndeclare const Ctor: any;\nfunction f(r: Rectangle) { return r instanceof Ctor; }` },
  ],
  invalid: [
    {
      name: "the book's example: the user checks whether the Rectangle is a Square",
      code: `${RECTANGLE}\nfunction resize(r: Rectangle) { if (r instanceof Square) return; r.w = 2; }`,
      errors: [{ messageId: "subtypeCheck", line: 3, data: { subtype: "Square", type: "Rectangle" } }],
    },
    {
      name: "a subtype of a project interface, in an else-if chain judged against the declared type",
      code: `${SHAPE}\nfunction draw(shape: Shape) { if (shape instanceof Circle) return 'c'; else if (shape instanceof Box) return 'b'; return '?'; }`,
      errors: [
        { messageId: "subtypeCheck", line: 4, data: { subtype: "Circle", type: "Shape" } },
        { messageId: "subtypeCheck", line: 4, data: { subtype: "Box", type: "Shape" } },
      ],
    },
    {
      name: "an indirect subclass, an optional declared type and a field",
      code: `${RECTANGLE}\nclass Tile extends Square {}\nclass Floor { private shape?: Rectangle; isTiled() { return this.shape instanceof Tile; } }`,
      errors: [{ messageId: "subtypeCheck", line: 4, data: { subtype: "Tile", type: "Rectangle" } }],
    },
    {
      name: "a project subclass of a project subclass of Error",
      code: "class AppError extends Error {}\nclass NotFound extends AppError {}\nfunction status(e: AppError) { return e instanceof NotFound ? 404 : 500; }",
      errors: [{ messageId: "subtypeCheck", line: 3, data: { subtype: "NotFound", type: "AppError" } }],
    },
  ],
});

runWithoutTypeInformation("no-subtype-check", rule, [`${RECTANGLE}\nfunction resize(r: Rectangle) { return r instanceof Square; }`]);
