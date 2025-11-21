import { BeynacError } from "../../../../core/BeynacError";
import { BaseClass } from "../../../../utils";

// Good: ends with Error and extends BeynacError
export class GoodError extends BeynacError {
	constructor() {
		super("good error");
	}
}

// Good: doesn't end with Error, extends BaseClass
export class RegularClass extends BaseClass {}

// Bad: ends with Error but doesn't extend BeynacError
export class FooError extends BaseClass {}

// Bad: extends BeynacError but doesn't end with Error
export class BadErrorExtension extends BeynacError {
	constructor() {
		super("bad extension");
	}
}
