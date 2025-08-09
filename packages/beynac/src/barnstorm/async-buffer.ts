export class AsyncBuffer {
	#buffer: Array<string | Promise<string> | Error> = [];
	#head = "";
	#resolvedUntil = -1;

	append(content: string | Promise<string>): void {
		if (typeof content === "string") {
			this.#head += content;
		} else {
			this.#buffer.push(this.#head);
			this.#head = "";
			const newPosition = this.#buffer.length;
			this.#buffer.push(content);
			content
				.catch((error: unknown) => {
					return error instanceof Error ? error : new Error(String(error));
				})
				.then((resolvedContent) => {
					this.#resolve(newPosition, resolvedContent);
				});
		}
	}

	get(): string | Promise<string> {
		if (this.resolved) {
			return this.#getAsResolved();
		}
		return this.#getAsync();
	}

	async *getChunks(): AsyncGenerator<string, void, void> {
		for (let i = 0; i < this.#buffer.length; i++) {
			const chunk = this.#buffer[i];
			if (chunk instanceof Error) {
				throw chunk;
			}
			if (chunk instanceof Promise) {
				yield await chunk;
			} else {
				yield chunk;
			}
		}
		yield this.#head;
	}

	get resolved(): boolean {
		return this.#resolvedUntil === this.#buffer.length - 1;
	}

	#resolve(index: number, content: string | Error) {
		this.#buffer[index] = content;
		while (
			this.#resolvedUntil + 1 < this.#buffer.length &&
			!(this.#buffer[this.#resolvedUntil + 1] instanceof Promise)
		) {
			++this.#resolvedUntil;
		}
	}

	async #getAsync(): Promise<string> {
		while (!this.resolved) {
			await this.#buffer[this.#resolvedUntil + 1];
		}
		return this.#getAsResolved();
	}

	#getAsResolved(): string {
		let result = "";
		for (const chunk of this.#buffer) {
			if (typeof chunk === "string") {
				result += chunk;
			} else {
				// because we're resolved we know that anything not a string is an Error
				throw chunk;
			}
		}
		result += this.#head;
		return result;
	}
}
