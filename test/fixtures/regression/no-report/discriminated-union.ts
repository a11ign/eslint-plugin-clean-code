type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

export function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
  }
}

export function describe(shape: Shape): string {
  switch (shape.kind) {
    case "circle":
      return `circle of radius ${shape.radius}`;
    case "square":
      return `square of side ${shape.side}`;
  }
}
