// Entry point - re-exports public API items

export {
	DOCUMENTED_CONST,
	DocumentedClass,
	type DocumentedInterface,
	type DocumentedType,
	documentedFunction,
} from "./documented";
export { overloadedFunction } from "./function-overloads";
export { SharedName } from "./type-value-same-name";
export {
	UNDOCUMENTED_CONST,
	UndocumentedClass,
	type UndocumentedInterface,
	type UndocumentedType,
	undocumentedFunction,
} from "./undocumented";

// Note: internal.ts exports are NOT re-exported here
