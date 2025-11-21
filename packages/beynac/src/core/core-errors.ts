/**
 * Base class for all Beynac errors
 */
export class BeynacError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}
