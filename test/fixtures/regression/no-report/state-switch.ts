export class Door {
  private state: "open" | "closed" = "closed";

  label(): string {
    switch (this.state) {
      case "open":
        return "Open";
      case "closed":
        return "Closed";
    }
  }

  canEnter(): boolean {
    switch (this.state) {
      case "open":
        return true;
      case "closed":
        return false;
    }
  }
}
