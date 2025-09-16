export class BeynacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeynacError";
  }
}
