import { BeynacEvent } from "../../../../core/BeynacEvent";
import { BaseClass } from "../../../../utils";

// Good: ends with Event and extends BeynacEvent
export class GoodEvent extends BeynacEvent {}

// Good: doesn't end with Event, extends BaseClass
export class RegularClass extends BaseClass {}

// Bad: ends with Event but doesn't extend BeynacEvent
export class FooEvent extends BaseClass {}

// Bad: extends BeynacEvent but doesn't end with Event
export class BadEventExtension extends BeynacEvent {}
