import { NullProtoObj } from "./matcher-utils";
import type { MatcherContext } from "./types";

export function createMatcher<T = unknown>(): MatcherContext<T> {
	const ctx: MatcherContext<T> = {
		root: { key: "" },
		static: new NullProtoObj(),
	};
	return ctx;
}
