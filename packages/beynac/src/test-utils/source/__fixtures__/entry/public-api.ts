// Entry point - re-exports public API items

export {
	DOCUMENTED_CONST,
	DocumentedClass,
	type DocumentedInterface,
	type DocumentedType,
	documentedFunction,
} from "../public-api/documented";
export { overloadedFunction } from "../public-api/function-overloads";
export { SharedName } from "../public-api/type-value-same-name";
export {
	UNDOCUMENTED_CONST,
	UndocumentedClass,
	type UndocumentedInterface,
	type UndocumentedType,
	undocumentedFunction,
} from "../public-api/undocumented";

// Note: internal.ts exports are NOT re-exported here
