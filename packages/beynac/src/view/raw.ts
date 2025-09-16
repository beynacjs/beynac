export class RawContent {
  #content: string;

  constructor(content: string) {
    this.#content = content;
  }

  toString(): string {
    return this.#content;
  }

  [Symbol.toPrimitive](): string {
    return this.#content;
  }
}

export function raw(content: string): RawContent {
  return new RawContent(content);
}
