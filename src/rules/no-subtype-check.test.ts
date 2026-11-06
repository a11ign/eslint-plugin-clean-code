import { runTypedRuleTests, runWithoutTypeInformation } from "../testing/run-typed-rule-tests.ts";
import rule from "./no-subtype-check.ts";

const RECTANGLE = "class Rectangle { constructor(public w: number, public h: number) {} }\nclass Square extends Rectangle { constructor(side: number) { super(side, side); } }";
const SHAPE = "interface Shape { area(): number }\nclass Circle implements Shape { area() { return 3; } }\nclass Box implements Shape { area() { return 1; } }";

runTypedRuleTests("no-subtype-check", rule, {
  valid: [
    // Regression case (catalog row 7): a discriminated union's tag is a data structure's tag, not a subtype test.
    "type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };\nfunction area(shape: Shape) { if (shape.kind === 'circle') return shape.r ** 2; return shape.side ** 2; }",
    "type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };\nfunction area(shape: Shape) { switch (shape.kind) { case 'circle': return 3; case 'square': return 1; } }",
    // A check against a type unrelated to the declared type, or against the declared type itself.
    `${RECTANGLE}\nclass Circle {}\nfunction f(r: Rectangle) { return r instanceof Circle; }`,
    `${RECTANGLE}\nfunction f(r: Rectangle) { return r instanceof Rectangle; }`,
    // `unknown`, `any` and unions: there is no single declared supertype.
    "function f(error: unknown) { return error instanceof Error; }",
    `${RECTANGLE}\nfunction f(x: any) { return x instanceof Square; }`,
    `${RECTANGLE}\nfunction f(x: Square | Date) { return x instanceof Square; }`,
    "try { JSON.parse('x'); } catch (error) { if (error instanceof SyntaxError) throw error; }",
    // A library supertype: `Error` subclasses are the platform's, not the project's.
    "function f(e: Error) { return e instanceof TypeError; }",
    "class AppError extends Error {}\nfunction f(e: Error) { return e instanceof AppError; }",
    // A right-hand side that is not a class.
    `${RECTANGLE}\ndeclare const Ctor: any;\nfunction f(r: Rectangle) { return r instanceof Ctor; }`,
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
